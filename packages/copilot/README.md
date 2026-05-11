# Copilot Package

Este paquete implementa la logica de copiloto IA para operaciones de reparto.

## Objetivo

Responder preguntas operativas del conductor a partir de datos estructurados:

- `inputData` (clientes, pedidos, productos)
- `routePlan` (secuencia y explicaciones)
- `loadPlan` (ubicacion de mercancia en el camion)

## API interna

- `runCopilot(input)` en `src/index.ts`
  - Construye contexto estructurado.
  - Construye prompt seguro para LLM.
  - Genera respuesta deterministicamente basada en JSON.

## Prompt seguro

`src/prompt.ts` define el contrato de prompt con estas reglas:

- No inventar datos.
- Solo usar informacion del contexto estructurado.
- Devolver acciones de UI para destacar parada/palet.

## Supuestos

- Si falta detalle de `loadPlan`, se devuelve respuesta segura sin inventar ubicaciones.
- Si no hay razonamiento de ruta, se devuelve secuencia como fallback.
- La simulacion de cambio de paradas es orientativa (no recalcula optimizadores).
