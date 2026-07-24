const CULQI_API = "https://api.culqi.com/v2";

async function culqiRequest(path, { method = "POST", body } = {}) {
  const res = await fetch(`${CULQI_API}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.CULQI_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.merchant_message || data?.user_message || `Culqi respondió ${res.status} sin detalle`;
    throw new Error(message);
  }

  return data;
}

// Campos confirmados en vivo contra la sandbox de Culqi (customers, tokens, cards).
export function createCustomer({ email, firstName = "Usuario", lastName = "Lumina", address = "No especificado", addressCity = "Lima", phoneNumber = "999999999" }) {
  return culqiRequest("customers", {
    body: {
      email,
      first_name: firstName,
      last_name: lastName,
      address,
      address_city: addressCity,
      country_code: "PE",
      phone_number: phoneNumber,
    },
  });
}

export function createCard({ customerId, tokenId }) {
  return culqiRequest("cards", {
    body: { customer_id: customerId, token_id: tokenId },
  });
}

// Planes y suscripciones: campos según la documentación pública de Culqi
// (docs.culqi.com/es/documentacion/pagos-online/recurrencia). NO se pudieron
// probar en vivo porque el producto "Suscripciones" todavía no está
// activado en la cuenta (GET /plans devuelve 400 vacío incluso sin body).
// Verificar contra una respuesta real la primera vez que se activen.
export function createPlan({ name, shortName, description, amountInCents, currency = "PEN", intervalUnitTime = "months", intervalCount = 1 }) {
  return culqiRequest("plans", {
    body: {
      name,
      short_name: shortName,
      description,
      amount: amountInCents,
      currency,
      interval_unit_time: intervalUnitTime,
      interval_count: intervalCount,
    },
  });
}

export function createSubscription({ cardId, planId }) {
  return culqiRequest("subscriptions", {
    body: { card_id: cardId, plan_id: planId, tyc: true },
  });
}

export function getSubscription(id) {
  return culqiRequest(`subscriptions/${id}`, { method: "GET" });
}

export function getCharge(id) {
  return culqiRequest(`charges/${id}`, { method: "GET" });
}

export function parseCulqiDate(value) {
  if (!value) return null;
  if (typeof value === "number") return new Date(value < 1e12 ? value * 1000 : value);
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}
