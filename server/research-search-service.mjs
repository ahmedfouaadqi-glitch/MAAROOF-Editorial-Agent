import { randomUUID } from "node:crypto";
import { commitReservation, reserveBudget } from "./research-budget.mjs";
import { executeResearchSearch, validateSearchRequest } from "./research-provider.mjs";
function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
export async function runMeteredResearchSearch({store,provider,workspaceId,taskId,input}){
 if(!provider)fail("Live search is not configured",503);
 const request=validateSearchRequest(input);
 const snapshot=await store.read();
 const task=snapshot.tasks?.[taskId];
 if(!task||task.workspaceId!==workspaceId||!task.article)fail("Editorial task not found",404);
 const reservationId="search-"+randomUUID();
 const reservation=await store.transact(state=>reserveBudget(state,{workspaceId,taskId,operation:"search",units:1,reservationId}));
 if(!reservation.allowed)return {allowed:false,quota:reservation};
 let result;
 try{
  result=await executeResearchSearch(request,{provider});
 }catch(error){
  // A timeout can occur after a provider accepted the request. Count attempted requests conservatively.
  await store.transact(state=>commitReservation(state,{workspaceId,taskId,reservationId}));
  throw error;
 }
 const quota=await store.transact(state=>{
  commitReservation(state,{workspaceId,taskId,reservationId});
  state.researchSearches ||= [];
  state.researchSearches.push({id:randomUUID(),workspaceId,taskId,...result,reservationId,recordedAt:new Date().toISOString()});
  const current=state.tasks[taskId];
  const limit=state.limits.searchesPerArticle;
  return {operation:"search",used:current.usage.search,limit,remaining:Math.max(0,limit-current.usage.search),reservationId,status:current.reservations[reservationId].status};
 });
 return {allowed:true,result,quota,verification:"unverified-search-results"};
}
