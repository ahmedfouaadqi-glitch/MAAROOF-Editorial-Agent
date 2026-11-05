export function listEditorialLibraryItems(state, workspaceId) {
  if (typeof workspaceId !== "string" || !workspaceId.trim() || workspaceId.length > 128) {
    const error = new Error("workspaceId must contain 1-128 characters");
    error.status = 400;
    throw error;
  }
  const conversations = new Map((state.editorialConversations || [])
    .filter(item => item.workspaceId === workspaceId)
    .map(item => [item.id, item]));
  return (state.conversationDrafts || [])
    .filter(item => item.workspaceId === workspaceId && conversations.has(item.conversationId))
    .map(item => {
      const conversation = conversations.get(item.conversationId);
      const message = (conversation.messages || []).find(entry => entry.id === item.messageId);
      return {
        id: item.id,
        workspaceId: item.workspaceId,
        conversationId: item.conversationId,
        messageId: item.messageId,
        title: item.title || item.topic || conversation.title || "Editorial draft",
        targetId: item.targetId || conversation.targetId,
        targetName: item.targetName || conversation.targetName,
        clientName: item.clientName || conversation.clientName || null,
        brandName: item.brandName || conversation.brandName || null,
        language: conversation.language || "ar",
        request: (conversation.messages || []).find(entry => entry.role === "user" && entry.createdAt <= (message?.createdAt || item.createdAt))?.content || "",
        format: item.format || "",
        hook: item.hook || "",
        body: item.body || "",
        callToAction: item.callToAction || "",
        hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
        videoScript: item.videoScript || "",
        onScreenText: item.onScreenText || "",
        geo: item.geo || {},
        mediaNotes: item.mediaNotes || "",
        factCheckNotes: Array.isArray(item.factCheckNotes) ? item.factCheckNotes : [],
        similarity: item.similarity || null,
        createdAt: item.createdAt
      };
    })
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}
