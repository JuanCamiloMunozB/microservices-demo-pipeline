# 1. Portada

**Universidad:** Universidad ICESI
**Programa:** Ingeniería de Sistemas
**Curso:** Ingeniería de Software V
**Taller:** Taller 1 - Construcción de Pipelines en Cloud
**Integrantes:**

* Julio Antonio Prado
* Juan Camilo Muñoz

**Docente:** Nicolas Echeverry
**Fecha de entrega:** 13 de abril
**Período académico:** 2026-1

---

# 2. Tabla de contenido

1. [Introducción](#3-introducción)
2. [Descripción del sistema base](#4-descripción-del-sistema-base)
3. [Metodología ágil seleccionada](#5-metodología-ágil-seleccionada)
4. [Estrategia de branching para desarrollo](#6-estrategia-de-branching-para-desarrollo)
5. [Estrategia de branching para operaciones](#7-estrategia-de-branching-para-operaciones)
6. [Patrones de diseño en la nube](#8-patrones-de-diseño-en-la-nube)
7. [Diagrama de arquitectura](#9-diagrama-de-arquitectura)
8. [Pipeline de desarrollo](#10-pipeline-de-desarrollo)
9. [Pipeline de infraestructura](#11-pipeline-de-infraestructura)
10. [Implementación de la infraestructura](#12-implementación-de-la-infraestructura)
---

# 3. Introducción

Este informe presenta el desarrollo del Taller 1 sobre construcción de pipelines en cloud a partir del repositorio `okteto/microservices-demo`, una aplicación distribuida de demostración compuesta por una interfaz de voto, Kafka, un servicio de procesamiento, PostgreSQL y una aplicación de resultados, con el objetivo de integrar decisiones de desarrollo y operaciones bajo un enfoque DevOps. En función de los criterios del enunciado, el trabajo abarca la selección de una metodología ágil, la definición de estrategias de branching para desarrollo y operaciones, la elección de patrones de diseño en la nube, la elaboración del diagrama de arquitectura y la preparación de la base técnica que soporta la automatización, la trazabilidad y el despliegue. En esta parte del informe se desarrollan específicamente la contextualización del sistema, la metodología de trabajo, la organización del equipo, las estrategias de branching, la selección de patrones y la arquitectura propuesta, como fundamento para las secciones posteriores dedicadas a pipelines, infraestructura, implementación y demostración del pipeline.

# 4. Descripción del sistema base

## 4.1 Repositorio seleccionado

El proyecto seleccionado para el desarrollo del taller fue `okteto/microservices-demo`. El sistema implementa una aplicación de votación sencilla en la que un usuario puede elegir entre dos opciones (Tacos y Burritos) y posteriormente consultar los resultados. Aunque el caso de uso es simple, la arquitectura interna no es monolítica. La aplicación se compone de varios microservicios especializados, lo que permite observar un flujo de extremo a extremo típico de sistemas distribuidos: una interfaz captura la solicitud, un canal de mensajería desacopla el envío del procesamiento, un servicio intermedio actualiza el estado persistente y una interfaz separada expone los resultados consolidados.

## 4.2 Componentes principales identificados

A partir del análisis del repositorio y de la arquitectura base, se identificaron los siguientes elementos principales:

* **Aplicación de voto**: componente orientado al usuario que presenta el formulario de votación y recibe la selección.
* **Kafka**: middleware de mensajería utilizado para desacoplar el ingreso del voto del procesamiento posterior.
* **Worker**: servicio encargado de consumir eventos desde Kafka y persistir el resultado correspondiente.
* **PostgreSQL**: almacén persistente donde se guarda el estado consolidado de los votos.
* **Aplicación de resultados**: servicio web encargado de exponer y actualizar la visualización de los resultados.

## 4.3 Flujo funcional del sistema

El flujo observado en el repositorio puede resumirse de la siguiente manera: el usuario interactúa con la aplicación de voto; el voto es enviado como mensaje al broker Kafka; el servicio `worker` consume el mensaje y registra el resultado en PostgreSQL; finalmente, la aplicación de resultados consulta la base de datos usando polling y muestra el estado actualizado.

---

# 5. Metodología ágil seleccionada

## 5.1 Criterios de selección

La metodología de trabajo debía responder a cuatro restricciones concretas del taller: tiempo de ejecución corto, ausencia práctica de múltiples iteraciones, equipo reducido y necesidad de coordinar decisiones tanto de desarrollo como de operaciones. Bajo estas condiciones, no resultaba conveniente adoptar un marco con alta carga ceremonial o con demasiados artefactos formales, porque eso habría consumido tiempo que debía invertirse en diseñar arquitectura, preparar branching, construir pipelines y desplegar infraestructura.

Adicionalmente, desde DevOps era importante privilegiar el flujo de trabajo, la visibilidad de tareas, la reducción de bloqueos y la entrega incremental de artefactos verificables. El objetivo no era solamente “gestionar tareas”, sino sostener un proceso compatible con automatización, cambios frecuentes y coordinación efectiva entre roles técnicos. DevOps enfatiza precisamente la reducción del tiempo entre el cambio y la puesta en producción, conservando calidad en el resultado.

## 5.2 Metodologías evaluadas

Se consideraron cinco enfoques: **Scrum**, **Kanban**, **XP**, **Scrumban** y **Lean Software Development**. Scrum fue descartado como marco principal por su mayor carga en eventos y roles explícitos, poco conveniente para un equipo pequeño y un tiempo tan limitado. XP resultó valioso por sus prácticas técnicas, especialmente integración continua y validación automática, pero no como método rector porque el taller exige también decisiones de infraestructura, documentación y despliegue. Scrumban aparecía como un híbrido viable, aunque agregaba complejidad metodológica innecesaria para el tamaño del proyecto. Lean aportaba principios útiles, pero no un mecanismo operativo suficientemente concreto para la ejecución diaria del taller.

## 5.3 Metodología seleccionada

La metodología seleccionada fue **Kanban**. La elección responde a que Kanban permite visualizar el trabajo, limitar el paralelismo, gestionar bloqueos y mover tareas según capacidad real, sin requerir iteraciones formales, ceremonias extensas o estructuras difíciles de sostener en una ventana de ejecución corta. Esta flexibilidad es especialmente valiosa cuando la carga del proyecto está distribuida entre tareas de código, arquitectura, despliegue, automatización y documentación.

## 5.4 Aplicación concreta de Kanban al proyecto

La aplicación de Kanban se basó en un tablero con flujo explícito y políticas de avance claras. Las columnas utilizadas fueron: **Pendiente**, **En desarrollo**, y **Terminado**. Esta estructura permitió representar no solo el desarrollo de funcionalidades, sino también el tránsito de decisiones arquitectónicas, scripts, manifiestos de infraestructura, evidencia de pipelines y secciones del informe.

Cada tarjeta se definió como una unidad de trabajo verificable, asociada a un entregable concreto del taller. Por ejemplo, no se utilizó una tarjeta ambigua como “hacer pipeline”, sino tareas más específicas como “implementar etapa de build y test”, “definir estrategia de branching para operaciones”, “incorporar Circuit Breaker al diagrama de despliegue” o “documentar la justificación del patrón Publisher-Subscriber”.

---

# 6. Estrategia de branching para desarrollo

## 6.1 Justificación para este proyecto

GitHub Flow fue la mejor opción para desarrollo porque el proyecto no requiere mantener múltiples versiones del producto en paralelo ni ciclos largos de release. El equipo necesitaba una estrategia ligera que permitiera hacer cambios concretos sobre el repositorio, validarlos por medio del pipeline y fusionarlos rápidamente a una rama estable. En ese contexto, usar otras estrategias como trunk-based development imponía una disciplina mayor sobre el trunk que no aportaba una ventaja clara para un equipo de este tamaño. 

## 6.2 Estructura de ramas propuesta

La estrategia adoptada para desarrollo se definió así:

* `main`: rama estable del proyecto, siempre en estado desplegable o integrable.
* `feature/<nombre-cambio>`: ramas cortas para nuevas funcionalidades o ajustes visibles.
* `hotfix/<nombre-ajuste>`: ramas de atención rápida sobre un problema identificado en una versión validada.
* `release/<nombre-release>`: ramas opcionales para preparar entregas formales, aunque no se priorizaron en esta fase del taller.

## 6.3 Flujo de trabajo

El flujo propuesto es el siguiente:

1. Crear la rama a partir de `main`.
2. Implementar el cambio de manera aislada.
3. Ejecutar validaciones locales mínimas.
4. Publicar la rama remota y abrir solicitud de integración.
5. Ejecutar pipeline de desarrollo sobre la rama.
6. Revisar el resultado del pipeline y corregir si es necesario.
7. Integrar en `main` únicamente cuando el cambio esté validado.
8. Eliminar la rama corta una vez fusionada.

## 6.4 Reglas de integración

Se definieron las siguientes reglas para fusionar cambios hacia `main`:

* Ningún cambio entra directamente a `main` sin pasar por rama corta.
* Todo cambio funcional debe tener revisión técnica mínima.
* Todo cambio debe ejecutar el pipeline de desarrollo.
* No se integran ramas con errores de compilación, pruebas fallidas o inconsistencias evidentes con el diseño.
* Los cambios de documentación pueden seguir un flujo más ligero, pero deben conservar trazabilidad.

---

# 7. Estrategia de branching para operaciones

## 7.1 Criterio de selección

Para el frente de operaciones se seleccionó una **adaptación de GitLab Flow para infraestructura**, utilizando ramas de entorno junto con ramas cortas para cambios operativos. La referencia consultada describe GitLab Flow como un enfoque que combina ramas de trabajo con ramas alineadas a ambientes, por ejemplo una rama principal, una de staging y una de producción, lo que facilita promover cambios de manera controlada entre contextos. 

## 7.2 Justificación para este proyecto

A diferencia del código de aplicación, los cambios de operaciones afectan manifiestos, configuraciones de despliegue, scripts y definiciones de infraestructura. Estos artefactos tienen una sensibilidad distinta: un error de configuración puede dejar sin servicio a varios componentes a la vez o impedir el aprovisionamiento correcto del entorno. Por esa razón, se consideró conveniente una estrategia más trazable que la usada en desarrollo, con una ruta explícita de validación antes de considerar un cambio como apto para producción.

## 7.3 Estructura de ramas propuesta

La estrategia definida para operaciones fue:

* `main`: rama de referencia para configuraciones base, templates y artefactos estables de infraestructura.
* `staging`: rama para validar cambios operativos antes de promoverlos.
* `production`: rama reservada para infraestructura aprobada y lista para despliegue estable.
* `infra/<nombre-cambio>`: ramas cortas para cambios en IaC, despliegue o aprovisionamiento.
* `config/<nombre-cambio>`: ramas cortas para configuración operativa.
* `opsfix/<nombre-ajuste>`: ramas rápidas para corrección urgente en scripts o manifiestos.

## 7.4 Flujo de trabajo

El flujo de trabajo planteado fue el siguiente:

1. Crear la rama operativa corta desde `main`.
2. Realizar el cambio sobre scripts, manifiestos o archivos de infraestructura.
3. Validar sintaxis y consistencia localmente.
4. Integrar en `staging` para validación en pipeline de infraestructura.
5. Revisar resultados del pipeline y del entorno.
6. Promover a `production` una vez aprobado el cambio.
7. Mantener registro del cambio y evidencia de despliegue.

Este flujo permite diferenciar claramente entre edición, validación e incorporación final.

## 7.5 Reglas de promoción entre ramas

Para evitar inconsistencias, se definieron estas reglas:

* Los cambios operativos no pasan directamente a `production`.
* Toda modificación debe validarse previamente en `staging`.
* Los cambios sobre infraestructura deben conservar trazabilidad respecto al problema que resuelven.
* Los scripts y manifiestos deben tratarse como código y quedar bajo control de versiones, con revisión técnica antes de su promoción.

---

# 8. Patrones de diseño en la nube

## 8.1 Criterios de selección

La selección de patrones se realizó a partir de dos observaciones principales sobre el sistema base y la arquitectura derivada. La primera fue que el sistema ya contaba con una capa de mensajería para desacoplar el ingreso del voto del procesamiento, pero la actualización de resultados hacia la aplicación de consulta seguía siendo una oportunidad clara para mejorar desacoplamiento y reactividad. La segunda fue que PostgreSQL aparecía como una dependencia compartida y crítica, tanto para lectura como para escritura, por lo que cualquier degradación en su disponibilidad afectaría directamente la estabilidad de `result-app` y `worker`.

Con base en estas observaciones, se escogieron dos patrones:

## 8.2 Patrón 1: Publisher and Subscriber

### 8.2.1 Problema identificado

En la arquitectura original, el principal problema en la capa de resultados era que `result-application` dependía de realizar **polling continuo sobre la base de datos** cada vez que necesitaba conocer el conteo más reciente de votos. Este enfoque hacía que la actualización de resultados dependiera de consultas repetidas a PostgreSQL, incluso cuando no existían cambios nuevos, generando acoplamiento innecesario entre la visualización y la persistencia, además de introducir una carga constante sobre la base de datos.

### 8.2.2 Justificación de aplicabilidad

Se seleccionó **Publisher and Subscriber** porque permite sustituir ese esquema de polling por un mecanismo de **notificación basada en eventos**. En este enfoque, el `worker`, después de procesar un voto y persistirlo, publica un evento indicando que el conteo fue actualizado; posteriormente, `result-application` se suscribe a ese evento y reacciona cuando realmente ocurre un cambio. El valor del patrón no estuvo en incorporar mensajería donde no existía, sino en **eliminar la necesidad de consultar repetidamente la base de datos para detectar cambios**, trasladando la actualización de resultados hacia un modelo reactivo y desacoplado.

### 8.2.3 Componentes involucrados

En la arquitectura final, el patrón se reflejó mediante:

* `ResultsUpdatePublisher` dentro del nodo `worker`
* `VoteResultsEventTopic` dentro del nodo `kafka`
* `ResultsUpdateSubscriber` dentro del nodo `result-application`

Estos componentes se añadieron para representar explícitamente el flujo de publicación y suscripción encargado de notificar cambios en el conteo de votos.

### 8.2.4 Beneficio esperado

El principal beneficio es la **eliminación del polling continuo desde `result-application` hacia la base de datos**. En lugar de consultar repetidamente PostgreSQL para verificar si el conteo cambió, el sistema ahora recibe una notificación cuando existe una actualización relevante. Esto reduce carga innecesaria sobre la base de datos, disminuye el acoplamiento temporal entre la lectura y la persistencia, y hace más clara la orientación asíncrona de la arquitectura.

## 8.3 Patrón 2: Circuit Breaker

### 8.3.1 Problema identificado

PostgreSQL es una dependencia central del sistema. Tanto `worker` como `result-app` interactúan con la base de datos, uno para escritura y otro para lectura. Si la base de datos presenta latencia o falla sostenida, ambos servicios podrían seguir intentando acceder a ella, provocando esperas innecesarias, saturación de recursos y propagación del error.

### 8.3.2 Justificación de aplicabilidad

Se seleccionó **Circuit Breaker** porque se adapta directamente al escenario de llamadas remotas hacia una dependencia posiblemente degradada. Azure establece que este patrón ayuda a evitar que una aplicación repita llamadas que probablemente seguirán fallando y que su objetivo es mejorar estabilidad y resiliencia frente a recursos remotos con recuperación variable. 

### 8.3.3 Componentes involucrados

En la arquitectura final, el patrón se materializó con dos componentes locales al consumidor de la dependencia:

* `ResultDbCircuitBreaker` dentro de `result-application`
* `WorkerDbCircuitBreaker` dentro de `worker`

La decisión de representarlos como componentes internos y no como un nodo central compartido se tomó porque el patrón opera del lado del cliente que invoca a la dependencia remota, no como un servicio autónomo separado.

### 8.3.4 Beneficio esperado

El beneficio esperado es doble. En `result-app`, el patrón evita insistir sobre PostgreSQL cuando el sistema de lectura se encuentra degradado. En `worker`, protege la ruta de escritura cuando la base de datos no puede absorber correctamente las inserciones. En ambos casos, el patrón mejora la resiliencia del sistema y hace visible una preocupación de tolerancia a fallos dentro del diseño.

---

# 9. Diagrama de arquitectura

![Diagrama de arquitectura](./image/Taller%201%20-%20Diagrama%20de%20Arquitectura-Diagrama%20con%20patrones.drawio.png)

# 10. Pipeline de desarrollo

## 10.1 Objetivo del pipeline de desarrollo

**Debe contener:**

* Qué automatiza el pipeline
* Qué etapas cubre
* Qué artefactos genera

## 10.2 Etapas del pipeline

**Debe contener:**

* Obtención del código
* Instalación de dependencias
* Compilación o build
* Pruebas
* Construcción de imagen o artefacto
* Publicación o entrega al siguiente flujo

## 10.3 Scripts utilizados

**Debe contener:**

* Scripts creados o adaptados
* Propósito de cada script
* Relación con el pipeline

## 10.4 Evidencia de funcionamiento

**Debe contener:**

* Capturas, logs o resultados de ejecución
* Explicación breve de la evidencia

---

# 11. Pipeline de infraestructura

> Esta sección debe incluir también los scripts necesarios para las tareas automatizadas. 

## 11.1 Objetivo del pipeline de infraestructura

**Debe contener:**

* Qué despliega o valida
* Qué parte de la infraestructura automatiza
* Relación con IaC o scripts de provisión

## 11.2 Etapas del pipeline de infraestructura

**Debe contener:**

* Validación de sintaxis o configuración
* Aprovisionamiento o despliegue
* Aplicación de configuraciones
* Verificación del entorno

## 11.3 Scripts o archivos de infraestructura utilizados

**Debe contener:**

* Manifiestos, scripts o definiciones de infraestructura
* Función de cada uno
* Cómo participan en la automatización

## 11.4 Evidencia de funcionamiento

**Debe contener:**

* Resultados del pipeline
* Capturas, logs o salidas del sistema

---

# 12. Implementación de la infraestructura

**Debe contener:**

* Descripción del entorno donde se desplegó la solución
* Recursos creados
* Servicios utilizados
* Configuraciones relevantes
* Evidencia de despliegue funcional

## 12.1 Entorno objetivo

**Debe contener:**

* Plataforma o proveedor utilizado
* Justificación breve de la elección

## 12.2 Recursos aprovisionados

**Debe contener:**

* Cómputo
* Red
* Contenedores o servicios de ejecución
* Base de datos
* Mensajería
* Otros recursos relevantes

## 12.3 Proceso de despliegue

**Debe contener:**

* Secuencia seguida para desplegar
* Dependencias entre recursos
* Problemas encontrados y solución aplicada

## 12.4 Validación de la infraestructura

**Debe contener:**

* Verificación de disponibilidad
* Verificación de comunicación entre componentes
* Evidencia de funcionamiento del sistema desplegado