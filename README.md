# Pruebas en CI/CD (Integración Continua y Despliegue Continuo)

## Introducción

Coauthored with @mariana-ruge01

Realizado para Focus App Diplomado 2026


La **Integración Continua (CI)** y el **Despliegue Continuo (CD)** son prácticas de desarrollo de software que buscan automatizar la integración de código, su validación y su despliegue. Las **pruebas automatizadas** son el corazón de estos procesos: sin ellas, CI/CD pierde gran parte de su valor, ya que no habría forma confiable de saber si un cambio rompe algo antes de llegar a producción.

---

## ¿Qué es CI (Integración Continua)?

Es la práctica de integrar cambios de código en un repositorio compartido de forma frecuente (varias veces al día), ejecutando automáticamente un conjunto de validaciones (build + pruebas) en cada integración.

**Objetivo:** detectar errores lo antes posible, evitando el clásico problema de "funciona en mi máquina".

## ¿Qué es CD (Despliegue/Entrega Continua)?

- **Continuous Delivery (Entrega Continua):** el código siempre está en un estado desplegable, pero el paso a producción requiere una aprobación manual.
- **Continuous Deployment (Despliegue Continuo):** cada cambio que pasa todas las pruebas se despliega automáticamente a producción, sin intervención humana.

---

## Tipos de pruebas en un pipeline de CI/CD

Un pipeline saludable suele seguir la llamada **pirámide de pruebas**, priorizando pruebas rápidas y baratas sobre las lentas y costosas.

### 1. Pruebas unitarias (Unit Tests)
- Validan la lógica de una función, método o clase de forma aislada.
- Son rápidas (milisegundos) y deben representar la mayor parte de la suite.
- Ejemplo de herramientas: Jest, JUnit, pytest, xUnit, RSpec.

### 2. Pruebas de integración (Integration Tests)
- Validan que varios componentes funcionen bien juntos (por ejemplo, la app con la base de datos, o con un servicio externo simulado).
- Más lentas que las unitarias, pero más rápidas que las end-to-end.
- Ejemplo de herramientas: Testcontainers, Supertest, pytest con fixtures.

### 3. Pruebas end-to-end (E2E)
- Simulan el flujo completo de un usuario real interactuando con la aplicación.
- Son las más lentas y frágiles, por lo que se ejecutan en menor cantidad.
- Ejemplo de herramientas: Cypress, Playwright, Selenium.

### 4. Pruebas de contrato (Contract Testing)
- Verifican que la comunicación entre servicios (por ejemplo, microservicios) respete un contrato acordado (formato de request/response).
- Ejemplo de herramientas: Pact.

### 5. Análisis estático de código (Linting / Static Analysis)
- No son "pruebas" en sentido estricto, pero forman parte del pipeline para detectar errores de estilo, code smells y vulnerabilidades.
- Ejemplo de herramientas: ESLint, SonarQube, Pylint.

### 6. Pruebas de seguridad (Security Testing)
- Escaneo de dependencias vulnerables (SCA) y análisis de seguridad estático (SAST).
- Ejemplo de herramientas: Snyk, Dependabot, OWASP ZAP.

### 7. Pruebas de rendimiento (Performance/Load Testing)
- Validan que la aplicación soporte la carga esperada.
- Suelen ejecutarse en etapas posteriores del pipeline (no en cada commit).
- Ejemplo de herramientas: k6, JMeter, Gatling.

### 8. Pruebas de humo (Smoke Tests)
- Conjunto mínimo de pruebas que verifican que lo esencial de la aplicación funciona tras un despliegue.
- Se ejecutan justo después de desplegar, antes de dar por exitoso el release.

---

## Flujo típico de un pipeline con pruebas

```
Commit / Push
     │
     ▼
1. Build (compilación)
     │
     ▼
2. Análisis estático (lint, SAST)
     │
     ▼
3. Pruebas unitarias
     │
     ▼
4. Pruebas de integración
     │
     ▼
5. Empaquetado (build de artefacto/imagen)
     │
     ▼
6. Despliegue a entorno de staging
     │
     ▼
7. Pruebas E2E / smoke tests
     │
     ▼
8. Aprobación (manual u automática)
     │
     ▼
9. Despliegue a producción
     │
     ▼
10. Smoke tests en producción
```

Si alguna etapa falla, el pipeline se detiene y notifica al equipo, evitando que código defectuoso avance.

---

## Buenas prácticas

- **Pruebas rápidas primero:** ejecutar unitarias antes que E2E para dar feedback rápido.
- **Fallar rápido (fail fast):** detener el pipeline en cuanto falle una etapa crítica.
- **Aislamiento de entornos:** usar contenedores (Docker) para pruebas reproducibles.
- **Datos de prueba controlados:** evitar dependencias de datos reales o compartidos entre ejecuciones.
- **Pruebas idempotentes:** que puedan ejecutarse múltiples veces sin efectos secundarios acumulativos.
- **Cobertura de código (code coverage):** usarla como guía, no como meta absoluta (evitar el "teatro de cobertura").
- **Paralelización:** ejecutar suites de pruebas en paralelo para reducir tiempos de pipeline.
- **Feature flags:** permiten desplegar código sin activarlo, reduciendo el riesgo de despliegues.
- **Rollback automático:** si las pruebas post-despliegue fallan, revertir automáticamente.

---

## Herramientas comunes de CI/CD

| Categoría | Herramientas |
|---|---|
| Plataformas CI/CD | GitHub Actions, GitLab CI/CD, Jenkins, CircleCI, Azure DevOps, Travis CI |
| Contenedores | Docker, Kubernetes |
| Gestión de artefactos | Nexus, JFrog Artifactory |
| Monitoreo post-despliegue | Datadog, New Relic, Prometheus + Grafana |

---

## Ejemplo simple de pipeline en GitHub Actions

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Instalar dependencias
        run: npm install

      - name: Ejecutar linter
        run: npm run lint

      - name: Ejecutar pruebas unitarias
        run: npm test

      - name: Ejecutar pruebas de integración
        run: npm run test:integration
```

---

## Conclusión

Las pruebas automatizadas en CI/CD no son un extra opcional, sino la base que permite integrar y desplegar código con confianza y frecuencia. Una buena estrategia combina distintos tipos de pruebas equilibrando velocidad, costo y cobertura, siguiendo el principio de la pirámide de pruebas: **muchas pruebas unitarias, algunas de integración y pocas end-to-end**.
