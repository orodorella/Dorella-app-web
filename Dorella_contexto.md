# Especificación de Producto — Ecosistema Digital Mayorista Dorela

**Versión:** 1.0 (v1 / MVP)
**Basado en:** PRD Ecosistema B2B Dorela Premium
**Alcance de este documento:** Requerimientos priorizados (P0/P1/P2) e historias de usuario por persona, con criterios de aceptación.

---

## 1. Problem Statement

Los distribuidores mayoristas de joyería en oro laminado 18k no tienen un canal digital que les permita comprar por volumen de forma rápida y profesional: las plataformas B2B existentes son toscas, parecen hojas de cálculo y destruyen el valor percibido de un producto que "se vende por los ojos". Al mismo tiempo, Dorela gestiona precios diferenciados, facturación, despachos y catálogos de forma manual, lo que limita su escalabilidad y la profesionalización de su red de microempresarios. El costo de no resolverlo es doble: se pierde margen y velocidad transaccional en el canal mayorista, y se frena la tesis de impacto social de empoderar emprendedores.

---

## 2. Goals

1. **Unificar el canal de venta** en una sola plataforma donde el login recalcule precios e interfaz según el tier del usuario (Detal, Por Mayor, Gran Mayor), sin portales separados.
2. **Reducir el tiempo de un pedido mayorista a menos de 2 minutos** para 50–100 artículos, mediante carga rápida, adición en lote y checkout optimizado.
3. **Proteger los márgenes mayoristas** detrás del muro de autenticación, mostrando descuentos (37.5% / 50%) solo a usuarios autenticados del tier correspondiente.
4. **Automatizar la operación de respaldo** (facturación vía Alegra, despachos vía transportadoras, notificaciones) para eliminar la gestión manual orden por orden.
5. **Aumentar el ticket promedio (AOV)** con mecánicas de gamificación que empujen al usuario hacia el siguiente umbral de descuento.
6. **Retener al sector B2B** entregándole herramientas que no encuentran en otro lado: catálogos white-label y recompensas por volumen.

---

## 3. Non-Goals (fuera de alcance de v1)

1. **LMS / Academia de Emprendedores completa** — Es un módulo proyectado a ~5 meses; se diseña la arquitectura para soportarlo, pero no se construye en v1.
2. **IA conversacional 24/7 de WhatsApp (Wati/ManyChat + ChatGPT)** — Es Fase 2. En v1 solo redirección inteligente a líneas de WhatsApp.
3. **App móvil nativa** — El alcance es web responsive; no hay app dedicada en esta versión.
4. **Recompensas experienciales totalmente automatizadas** (viajes, glamping, autos) — En v1 se mide y se muestra el progreso; la entrega del premio se gestiona manualmente desde backoffice.
5. **Marketplace multi-proveedor** — La plataforma vende exclusivamente catálogo Dorela; no se habilita venta de terceros.

---

## 4. Personas

| Persona | Tier / Rol | Necesidad central |
|---|---|---|
| **Cliente Detal** | B2C, 0% | Comprar piezas sueltas con experiencia aspiracional. |
| **Mayorista** | B2B Standard, 37.5%, mín. $500.000 | Comprar volumen rápido a precio especial. |
| **Gran Mayorista** | B2B VIP, 50%, mín. $5.000.000 | Máximo margen + herramientas pro (catálogos, beneficios). |
| **Administrador Dorela** | Backoffice | Gestionar clientes, niveles, inventario y métricas. |
| **José / Fundador** | Estratégico | Escalar la red y medir impacto del negocio. |

---

## 5. Historias de Usuario

### 5.1 Autenticación y precios dinámicos (núcleo)

- Como **mayorista**, quiero que al iniciar sesión la tienda recalcule automáticamente todos los precios a mi tarifa especial, para no tener que pedir cotizaciones manuales.
- Como **mayorista**, quiero ver el precio público tachado junto a mi precio con descuento, para percibir claramente el valor de mi tier.
- Como **gran mayorista**, quiero que mis precios reflejen el 50% de descuento en toda la navegación, para confirmar que estoy obteniendo el margen máximo.
- Como **visitante detal**, quiero ver precios públicos sin necesidad de cuenta, para comprar de inmediato sin fricción.
- Como **dueño del negocio**, quiero que ningún usuario no autenticado pueda ver precios mayoristas, para proteger mis márgenes de la competencia.
- Como **usuario nuevo**, quiero registrarme y entender qué requisitos cumplen para acceder a cada tier, para saber cómo desbloquear mejores precios.

### 5.2 Pedido mayorista rápido (eficiencia transaccional)

- Como **mayorista**, quiero agregar productos al carrito en lote desde un listado (sin entrar a 20 fichas), para armar un pedido de 50–100 ítems en menos de 2 minutos.
- Como **mayorista**, quiero ajustar cantidades por fila directamente en la lista, para corregir mi pedido sin recargar páginas.
- Como **mayorista**, quiero un checkout corto y optimizado, para cerrar la compra sin pasos innecesarios.
- Como **mayorista**, quiero ver el subtotal y el descuento aplicado en todo momento en el carrito, para confirmar mi ahorro antes de pagar.

### 5.3 Gamificación y upselling

- Como **cliente detal cerca del umbral**, quiero ver cuánto me falta para activar precios Por Mayor, para sentirme incentivado a aumentar mi compra.
- Como **mayorista**, quiero ver una barra de progreso hacia el rango Gran Mayor, para entender el beneficio de subir mi pedido.
- Como **dueño del negocio**, quiero mensajes persuasivos automáticos en el carrito según el valor actual, para aumentar el ticket promedio sin intervención humana.

### 5.4 Catálogos White-Label

- Como **mayorista/gran mayorista**, quiero seleccionar productos y exportar un catálogo PDF sin logos, nombres ni precios de Dorela, para revenderlo bajo mi propia marca.
- Como **distribuidor**, quiero configurar mi propio margen de ganancia sobre el catálogo exportado, para enviar precios finales a mis clientes de inmediato.
- Como **distribuidor**, quiero también generar un enlace web espejo del catálogo, para compartirlo digitalmente sin crear un PDF.

### 5.5 Recompensas por volumen

- Como **mayorista**, quiero ver mis compras acumuladas (trimestral/anual) y los hitos disponibles, para saber qué premios estoy por desbloquear.
- Como **gran mayorista top**, quiero recibir notificación cuando alcance un hito, para reclamar mi recompensa experiencial.

### 5.6 Administrador (Backoffice)

- Como **administrador**, quiero ver la base de clientes con su histórico de compras, para tomar decisiones de gestión de cuenta.
- Como **administrador**, quiero aprobar (manual o automáticamente) el ascenso de un cliente a Gran Mayor tras verificar metas, para controlar quién accede al margen máximo.
- Como **administrador**, quiero un panel con KPIs (recompra de mayoristas, productos de mayor rotación, catálogos generados), para medir la salud del canal.

### 5.7 Automatizaciones de respaldo

- Como **administrador**, quiero que cada orden genere su factura en Alegra automáticamente, para eliminar la facturación manual.
- Como **bodega**, quiero que al confirmarse el pago se genere la guía de transporte en PDF, para despachar sin crear órdenes a mano.
- Como **comprador**, quiero recibir mi código de seguimiento por email y WhatsApp al instante, para conocer el estado de mi envío.
- Como **visitante detal con dudas**, quiero un botón que me redirija a WhatsApp, para resolver mi consulta y cerrar la compra asistida.

### 5.8 Casos límite y estados

- Como **mayorista**, quiero un mensaje claro si mi carrito no alcanza la compra mínima de mi tier, para entender por qué no se aplica el descuento esperado.
- Como **comprador**, quiero ver disponibilidad real de stock, para no pedir unidades agotadas.
- Como **usuario**, quiero un estado vacío amigable en mi carrito y catálogos, para saber qué hacer a continuación.
- Como **administrador**, quiero que una falla de la API de Alegra o de la transportadora quede registrada y reintentable, para que ninguna orden se pierda silenciosamente.

---

## 6. Requerimientos

### 6.1 Must-Have (P0) — sin esto no hay producto

**P0-1 · Motor de precios por tier atado al login**
El sistema asigna a cada usuario un tier (Detal 0% / Por Mayor 37.5% / Gran Mayor 50%) y renderiza precios en tiempo real: `P_mayor = P × (1 − 0.375)`, `P_gran_mayor = P × (1 − 0.50)`.
*Criterios de aceptación:*
- [ ] Dado un usuario no autenticado, cuando navega el catálogo, entonces ve solo precios públicos (0%).
- [ ] Dado un mayorista autenticado, cuando ve un producto, entonces ve el precio público tachado y su precio con 37.5% calculado.
- [ ] Dado un gran mayorista, entonces todos los precios reflejan 50%.
- [ ] El precio mayorista nunca se expone en HTML/API a usuarios no autenticados del tier.

**P0-2 · Pedido en lote y checkout optimizado (<2 min para 50–100 ítems)**
*Criterios de aceptación:*
- [ ] El usuario puede agregar múltiples productos al carrito desde una vista de listado sin abrir fichas individuales.
- [ ] El usuario puede editar cantidades por fila en el listado/carrito.
- [ ] El flujo desde "lista" hasta "orden confirmada" no excede los pasos definidos como meta de UX.
- [ ] El carrito muestra subtotal, descuento aplicado y total en cada cambio.

**P0-3 · Validación de compra mínima por tier**
*Criterios de aceptación:*
- [ ] Por Mayor exige mínimo $500.000; Gran Mayor exige mínimo $5.000.000.
- [ ] Si el carrito no alcanza el mínimo, el sistema muestra mensaje claro y no aplica el descuento del tier superior.

**P0-4 · Gamificación de umbrales en carrito**
*Criterios de aceptación:*
- [ ] Si `V_c < $500.000`, muestra cuánto falta para activar Por Mayor.
- [ ] Si `$500.000 ≤ V_c < $5.000.000`, confirma el 37.5% y muestra cuánto falta para Gran Mayor.
- [ ] Los mensajes se recalculan en tiempo real con cada cambio del carrito.

**P0-5 · Integración de facturación con Alegra (API)**
*Criterios de aceptación:*
- [ ] Cada orden B2B/B2C genera factura en Alegra automáticamente.
- [ ] El inventario se descuenta en tiempo real al confirmar la orden.
- [ ] Un fallo de la API queda registrado y la orden marcada para reintento, sin pérdida.

**P0-6 · Identidad visual premium + eficiencia (UI dual)**
*Criterios de aceptación:*
- [ ] La interfaz usa tipografías serif, paleta marfil/negro/oro champán, imágenes en alta resolución y espacio negativo (inspiración Cartier/Tiffany).
- [ ] La estética premium no compromete la velocidad de carga ni la mecánica de pedido en lote.
- [ ] Diseño responsive en escritorio y móvil.

**P0-7 · Backoffice de clientes, niveles e inventario**
*Criterios de aceptación:*
- [ ] El admin ve la base de clientes y su histórico de compras.
- [ ] El admin puede aprobar/promover el tier de un cliente (manual o por regla).
- [ ] El admin visualiza el inventario centralizado sincronizado con las ventas.

### 6.2 Nice-to-Have (P1) — fast-follow tras el lanzamiento

**P1-1 · Generador de catálogos White-Label (PDF)**
- [ ] Mayorista/Gran Mayorista selecciona productos y exporta PDF sin marca Dorela.
- [ ] El distribuidor define su margen sobre los precios del catálogo.

**P1-2 · Automatización logística (APIs de transportadoras)**
- [ ] Al confirmar pago se crea la orden de recogida y se genera la guía PDF para bodega.
- [ ] El código de seguimiento se notifica por email y WhatsApp al comprador.

**P1-3 · Panel de KPIs analíticos**
- [ ] Muestra tasa de recompra de mayoristas, productos de mayor rotación y volumen de catálogos generados.

**P1-4 · Recompensas por volumen (medición + progreso)**
- [ ] El panel del usuario muestra compras acumuladas y progreso hacia hitos.
- [ ] La entrega del premio se gestiona desde backoffice (no automatizada en esta fase).

**P1-5 · Redirección inteligente a WhatsApp (Fase 1)**
- [ ] Botones contextuales de WhatsApp para tráfico detal y dudas iniciales.

### 6.3 Future Considerations (P2) — diseñar para soportarlas, no construir ahora

- **P2-1 · Enlace web espejo del catálogo white-label** (además del PDF).
- **P2-2 · LMS / Academia de Emprendedores** (~5 meses).
- **P2-3 · IA de WhatsApp 24/7** (Wati/ManyChat + ChatGPT) con catálogo Dorela cargado.
- **P2-4 · Automatización completa de entrega de recompensas experienciales.**
- **P2-5 · Exportador de catálogos avanzados como herramienta exclusiva Gran Mayor.**

---

## 7. Success Metrics

**Leading (días–semanas):**
- Tiempo medio para completar un pedido mayorista de 50–100 ítems: **objetivo < 2 min** (stretch < 90 s).
- Tasa de activación B2B: % de cuentas mayoristas que completan ≥1 pedido en los primeros 30 días.
- % de carritos que cruzan un umbral de descuento tras ver el mensaje de gamificación.
- Tasa de error en checkout y en sincronización con Alegra: **objetivo < 2%**.

**Lagging (semanas–meses):**
- Tasa de recompra de mayoristas trimestral.
- Crecimiento del AOV vs. línea base manual.
- % de mayoristas que generan al menos un catálogo white-label (proxy de retención B2B).
- Reducción de tiempo operativo manual en facturación y despachos.

---

## 8. Open Questions

- **(Negocio/José)** ¿Los hitos de recompensas se miden trimestral, anual o ambos en simultáneo? ¿Cuáles son los umbrales exactos por premio?
- **(Negocio)** ¿El ascenso a Gran Mayor es automático al cumplir metas o siempre requiere aprobación manual? — *bloqueante para P0-7.*
- **(Ingeniería)** ¿La migración Siigo→Alegra estará completa antes del lanzamiento, o el sistema debe convivir temporalmente con ambos? — *bloqueante para P0-5.*
- **(Ingeniería)** ¿Qué transportadoras y qué APIs específicas se integran primero? — afecta P1-2.
- **(Diseño/Datos)** ¿Cuál es la meta concreta de "≤ N pasos" para considerar el checkout optimizado?
- **(Legal)** ¿El catálogo white-label requiere algún descargo sobre uso de marca/imágenes por parte del distribuidor?

---

## 9. Timeline / Fases sugeridas

- **Fase 1 (MVP / v1):** P0-1 a P0-7 — núcleo transaccional, precios por tier, gamificación, Alegra y backoffice. Es el mínimo que resuelve el problema central.
- **Fase 2 (Fast-follow):** P1-1 a P1-5 — white-label PDF, logística automatizada, KPIs, recompensas (medición) y WhatsApp Fase 1.
- **Fase 3 (Mediano plazo):** P2 — LMS (~5 meses), IA de WhatsApp, enlace espejo y automatización de premios.

**Dependencias duras:** la integración con Alegra depende del avance de la migración contable; la logística depende de los contratos/credenciales con las transportadoras.

---

## 10. Referentes (benchmarks)

- **Shopify Plus (B2B Suite):** listas de precios variables atadas al login y checkout exclusivo para empresas.
- **NuORDER by Lightspeed:** estándar para line sheets y catálogos interactivos personalizables (referencia para white-label).
- **Faire Marketplace:** gamificación de portales B2B, paneles para minoristas e incentivos por volumen.