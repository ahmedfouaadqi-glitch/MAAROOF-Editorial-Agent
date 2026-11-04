import { randomUUID } from "node:crypto";

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function normalizeName(value) {
  return value.normalize("NFKC").toLocaleLowerCase().trim().replace(/\s+/g, " ");
}

function optionalName(value, field) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 120) {
    fail(`${field} must contain 2-120 characters`);
  }
  return value.trim().replace(/\s+/g, " ");
}

function publicRecord({ normalizedName: _normalizedName, ...record }) {
  return record;
}

export function resolveEditorialIdentities(state, { workspaceId, clientId, brandId, clientName, brandName }) {
  state.clients ||= [];
  state.brands ||= [];
  let client = null;
  const cleanClientName = optionalName(clientName, "clientName");
  const cleanBrandName = optionalName(brandName, "brandName");

  if (clientId != null && clientId !== "") {
    if (typeof clientId !== "string") fail("clientId must be a string");
    client = state.clients.find(item => item.id === clientId && item.workspaceId === workspaceId) || null;
    if (!client) fail("Client not found in this workspace", 404);
  }
  if (cleanClientName) {
    const normalizedName = normalizeName(cleanClientName);
    const namedClient = state.clients.find(item => item.workspaceId === workspaceId && item.normalizedName === normalizedName) || null;
    if (client && namedClient && client.id !== namedClient.id) fail("clientId and clientName refer to different clients", 409);
    if (client && client.normalizedName !== normalizedName) fail("clientId and clientName refer to different clients", 409);
    client = namedClient || client;
    if (!client) {
      client = { id: randomUUID(), workspaceId, name: cleanClientName, normalizedName, createdAt: new Date().toISOString() };
      state.clients.push(client);
    }
  }

  let brand = null;
  if (brandId != null && brandId !== "") {
    if (typeof brandId !== "string") fail("brandId must be a string");
    brand = state.brands.find(item => item.id === brandId && item.workspaceId === workspaceId) || null;
    if (!brand) fail("Brand not found in this workspace", 404);
    if (client && brand.clientId !== client.id) fail("Brand does not belong to the selected client", 409);
    if (!client && brand.clientId) {
      client = state.clients.find(item => item.id === brand.clientId && item.workspaceId === workspaceId) || null;
      if (!client) fail("Brand client is not available in this workspace", 409);
    }
  }
  if (cleanBrandName) {
    const normalizedName = normalizeName(cleanBrandName);
    const parentClientId = client?.id || null;
    const namedBrand = state.brands.find(item => item.workspaceId === workspaceId && item.clientId === parentClientId && item.normalizedName === normalizedName) || null;
    if (brand && namedBrand && brand.id !== namedBrand.id) fail("brandId and brandName refer to different brands", 409);
    if (brand && (brand.normalizedName !== normalizedName || brand.clientId !== parentClientId)) fail("brandId and brandName refer to different brands", 409);
    brand = namedBrand || brand;
    if (!brand) {
      brand = { id: randomUUID(), workspaceId, clientId: parentClientId, name: cleanBrandName, normalizedName, createdAt: new Date().toISOString() };
      state.brands.push(brand);
    }
  }

  return {
    ...(client ? { clientId: client.id, clientName: client.name } : {}),
    ...(brand ? { brandId: brand.id, brandName: brand.name } : {})
  };
}

export function listEditorialClients(state, workspaceId) {
  return (state.clients || []).filter(item => item.workspaceId === workspaceId).map(publicRecord).sort((a, b) => a.name.localeCompare(b.name));
}

export function listEditorialBrands(state, workspaceId, clientId = null) {
  return (state.brands || [])
    .filter(item => item.workspaceId === workspaceId && (clientId == null || item.clientId === clientId))
    .map(publicRecord)
    .sort((a, b) => a.name.localeCompare(b.name));
}
