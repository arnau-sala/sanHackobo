# Assumptions

- **Node 20+** recomendado (fetch global, TS moderno).
- **Monorepo npm workspaces**: dependencias enlazadas con nombres `@damm/*`.
- **Demo sin LLM externo**: el copilot actual usa lógica/heurística local; ElevenLabs es solo para audio opcional.
- **Contratos**: tipos compartidos viven en `@damm/contracts` y en los `package.json` de cada paquete; evita importar rutas internas (`src/foo/bar`) de otro paquete salvo transición.
- **Salidas generadas** (p. ej. `data/routePlan-output.json`) están en `.gitignore` cuando son locales.
