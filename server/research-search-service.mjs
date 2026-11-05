import { randomUUID } from "node:crypto";
import { commitReservation, reserveBudget } from "./research-budget.mjs";
import { executeResearchSearch, validateSearchRequest } from "./research-provider.mjs";
function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
export async function runMeteredResearchSearch({store,provider,workspaceId,taskId,input,operationId}){
 if(!provider)fail("Live search is not configured",503);
 const request=validateSearchRequest(input);
 const snapshot=await store.read();
 const task=snapshot.tasks?.[taskId];
 if(!task||task.workspaceId!==workspaceId||!task.article)fail("Editorial task not found",404);
 const reservationId=typeof operationId==="string"&&operationId.length>=8&&operationId.length<=128 ? "search-"+operationId : "search-"+randomUUID();
 const prior=(snapshot.researchSearches||[]).find(item=>item.workspaceId===workspaceId&&item.taskId===taskId&&item.reservationId===reservationId);
 if(prior)return {allowed:true,replayed:true,result:prior,verification:"unverified-search-results"};
 if(snapshot.tasks[taskId].reservations?.[reservationId])fail("This search operation was already started but has no saved result. Check its state before using a new operation ID.",409);
 const reservation=await store.transact(state=>reserveBudget(state,{workspaceId,taskId,operation:"search",units:1,reservationId}));
 if(!reservation.allowed)return {allowed:false,quota:reservation};
 if(reservation.replayed)fail("This search operation is already in progress. Reuse the same operation ID after its result is saved.",409);
 let result;
 try{result=await executeResearchSearch(request,{provider});}
 catch(error){
  // Provider acceptance may precede a timeout; retain the charge and prevent unsafe replay.
  await store.transact(state=>commitReservation(state,{workspaceId,taskId,reservationId}));
  throw error;
 }
 const saved=await store.transact(state=>{
  commitReservation(state,{workspaceId,taskId,reservationId});
  state.researchSearches||=[];
  const record={id:randomUUID(),workspaceId,taskId,...result,reservationId,recordedAt:new Date().toISOString()};
  state.researchSearches.push(record);
  const current=state.tasks[taskId];const limit=state.limits.searchesPerArticle;
  return {record,quota:{operation:"search",used:current.usage.search,limit,remaining:Math.max(0,limit-current.usage.search),reservationId,status:current.reservations[reservationId].status}};
 });
 return {allowed:true,replayed:false,result:saved.record,quota:saved.quota,verification:"unverified-search-results"};
}
