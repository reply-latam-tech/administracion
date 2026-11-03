# Detalle Exhaustivo de Cambios Realizados (01/11/2026 – 03/11/2026)

Este documento detalla, de manera cronológica y temática, la totalidad de los cambios, ajustes comerciales, altas de clientes, modificaciones en bases de datos y desarrollo de frontend realizados en la plataforma **Forecast / Liquidaciones** desde el **1 de noviembre de 2026**.

---

## Índice General
1. [Resumen Ejecutivo de Hitos](#resumen-ejecutivo-de-hitos)
2. [Desglose Punto por Punto de los Cambios](#desglose-punto-por-punto-de-los-cambios)
   - [Punto 1: Onboarding y Escala por Inflación de ZAZ (01/11)](#punto-1-onboarding-y-escala-por-inflación-de-zaz-0111)
   - [Punto 2: Modelo de Liquidación por Créditos de Grupo Axo México (02/11)](#punto-2-modelo-de-liquidación-por-créditos-de-grupo-axo-méxico-0211)
   - [Punto 3: Alta y Tarifa Plana Mensual de Cachafaz (02/11)](#punto-3-alta-y-tarifa-plana-mensual-de-cachafaz-0211)
   - [Punto 4: Automatización de Ingesta y Corrección de Desfase de Botmaker (02/11 – 03/11)](#punto-4-automatización-de-ingesta-y-corrección-de-desfase-de-botmaker-0211--0311)
   - [Punto 5: Facturación Real de Cierre Octubre 2026 y Recálculo Regional (02/11)](#punto-5-facturación-real-de-cierre-octubre-2026-y-recálculo-regional-0211)
   - [Punto 6: Registro de Baja de Cliente Abarka al 30/09/2026 (02/11)](#punto-6-registro-de-baja-de-cliente-abarka-al-30092026-0211)
   - [Punto 7: Actualización de Tipos de Cambio Oficiales Octubre 2026 (02/11)](#punto-7-actualización-de-tipos-de-cambio-oficiales-octubre-2026-0211)
   - [Punto 8: Actualización de Markup Botmaker al 25% desde Octubre 2026 (02/11)](#punto-8-actualización-de-markup-botmaker-al-25-desde-octubre-2026-0211)
   - [Punto 9: Regla Comercial de Café Martínez: Descuento 20% y Exclusión Botmaker (02/11)](#punto-9-regla-comercial-de-café-martínez-descuento-20-y-exclusión-botmaker-0211)
   - [Punto 10: Botmaker en Cuentas del Exterior: Conversión a USD y Pisos Mínimos (USD 170 / 190) (02/11 – 03/11)](#punto-10-botmaker-en-cuentas-del-exterior-conversión-a-usd-y-pisos-mínimos-usd-170--190-0211--0311)
   - [Punto 11: Corrección de Paginación en Supabase y Resaltado de Escalas (02/11 – 03/11)](#punto-11-corrección-de-paginación-en-supabase-y-resaltado-de-escalas-0211--0311)
   - [Punto 12: Corrección de Moneda de Cobro a USD en Directorio de Clientes (03/11)](#punto-12-corrección-de-moneda-de-cobro-a-usd-en-directorio-de-clientes-0311)
   - [Punto 13: Evacol Colombia Multicanal: Alta de Dafiti, Cruce en USD y Liquidación en COP (03/11)](#punto-13-evacol-colombia-multicanal-alta-de-dafiti-cruce-en-usd-y-liquidación-en-cop-0311)
   - [Punto 14: Pinturas Online: Exclusión Definitiva de Botmaker (03/11)](#punto-14-pinturas-online-exclusión-definitiva-de-botmaker-0311)
   - [Punto 15: Liquidación Botmaker Octubre: Alma Nativa, Forbasse, Salvita y Auditoría Nestlé (03/11)](#punto-15-liquidación-botmaker-octubre-alma-nativa-forbasse-salvita-y-auditoría-nestlé-0311)
   - [Punto 16: Natura México Multicanal: Alta de Amazon, Escalas Compartidas, Botmaker USD 200 y Factura Única (03/11)](#punto-16-natura-méxico-multicanal-alta-de-amazon-escalas-compartidas-botmaker-usd-200-y-factura-única-0311)
   - [Punto 17: Optimización de UX: Columnas Sticky Opacas y Corrección de Scroll Horizontal (02/11 – 03/11)](#punto-17-optimización-de-ux-columnas-sticky-opacas-y-corrección-de-scroll-horizontal-0211--0311)
3. [Registro de Commits Git](#registro-de-commits-git)

---

## Resumen Ejecutivo de Hitos

Entre el 1 y el 3 de noviembre se llevaron adelante hitos estructurales en la plataforma de forecast y liquidación de Reply:
* **Perfeccionamiento del módulo Botmaker:** Actualización de markup al 25% desde octubre 2026, corrección del desfase cronológico (consumos de septiembre liquidados en octubre), cobro en USD con pisos de USD 170 / USD 190 para cuentas internacionales, y ajustes puntuales de cuentas argentinas (Forbasse, Salvita, Alma Nativa, Pinturas Online).
* **Consolidados Multicanal Internacionales:** Modelado unificado de marcas multicanal en Colombia (Evacol con MELI + ADDI + Dafiti liquidado en COP) y México (Natura México con MELI + Amazon liquidado en USD con Botmaker fijo de USD 200).
* **Incorporaciones y bajas:** Onboarding de ZAZ y Cachafaz; baja y desindexación de Abarka.
* **Integridad de datos y UI:** Paginación de queries en Supabase (> 1000 registros), actualización de tipos de cambio de cierre de octubre y eliminación de transparencias en columnas fijas.

---

## Desglose Punto por Punto de los Cambios

### Punto 1: Onboarding y Escala por Inflación de ZAZ (01/11)
* **Qué es:** Incorporación de la marca **ZAZ** al portafolio de Reply en Argentina.
* **Qué se pidió:** Dar de alta la cuenta, insertar las ventas reales auditadas del mes de octubre 2026, configurar su escala de comisiones indexada mensualmente por inflación (REM) y proyectar los 11 meses restantes.
* **Qué se ajustó:**
  * Base de datos: Registro en `dim_sellers`, carga de ventas en `facturacion` (marcada como `REAL` en `2026-10-01`).
  * Escalas: Inserción en `dim_escalas` de los tramos con su factor de variación mensual por inflación oficial.
  * Backend/Proyecciones: Generación de proyección matemática a 12 meses basada en estacionalidad.

### Punto 2: Modelo de Liquidación por Créditos de Grupo Axo México (02/11)
* **Qué es:** Modelo de facturación no porcentual para **Grupo Axo México** (marcas Calvin Klein y Tommy Hilfiger en Mercado Libre y Liverpool).
* **Qué se pidió:** Grupo Axo factura en base al consumo mensual de **créditos operativos** (bolsas de tickets). Se requería cruzar los créditos consumidos con su escala de precios unitarios por crédito, convertir el resultado a USD sin IVA y mostrar el bloque multicanal en la tabla de liquidaciones.
* **Qué se ajustó:**
  * Base de datos: Creación y alimentación de la tabla `fact_metricas_operativas` para créditos de Axo.
  * Frontend (`page.tsx`): Lógica de cálculo en base al tramo de créditos alcanzado, conversión a USD mediante el tipo de cambio oficial del mes y renderizado de la sección multicanal con desglose por marca (CK y TH) y canal (MELI y Liverpool).

### Punto 3: Alta y Tarifa Plana Mensual de Cachafaz (02/11)
* **Qué es:** Cliente **Cachafaz** en Argentina (`seller_id: 1042784747`).
* **Qué se pidió:** Vincular la cuenta comercialmente, cargar sus ventas reales de octubre y fijar en la liquidación un honorario pactado de **$1.200.000 + IVA fijo mensual** para los meses de agosto, septiembre y octubre 2026.
* **Qué se ajustó:**
  * Base de datos: Creación en `dim_sellers` (`id_cliente: 19`), carga de facturación real.
  * Escalas: Configuración de escala plana con tipo de cargo `MINIMO` en `$1.200.000,00` ARS para dichos períodos.
  * Frontend: Reflejo en la tabla con cálculo de IVA al 21% (`$252.000,00`) y total factura de `$1.452.000,00`.

### Punto 4: Automatización de Ingesta y Corrección de Desfase de Botmaker (02/11 – 03/11)
* **Qué es:** Sincronización y cálculo de costos de licencias y consumos de Botmaker.
* **Qué se pidió:**
  1. Activar la bandera `cobrar_botmaker = true` a las cuentas activas que efectivamente utilizan el servicio.
  2. Corregir el criterio de asignación: Botmaker liquida a mes vencido (los consumos consumidos en septiembre se pagan en la liquidación de octubre). Anteriormente se cargaban en el mismo mes calendario, provocando que octubre no reflejara consumos.
* **Qué se ajustó:**
  * Script de ingesta (`ingest_botmaker`): Adaptación para asociar los consumos de septiembre 2026 al período de liquidación `2026-10-01`.
  * Base de datos: Actualización en `dim_sellers` de banderas de cobro y recálculo de la vista SQL `liquidaciones`.

### Punto 5: Facturación Real de Cierre Octubre 2026 y Recálculo Regional (02/11)
* **Qué es:** Cierre contable de ventas reales de octubre 2026 para todos los países (Argentina, México, Colombia, Chile, Perú).
* **Qué se pidió:** Reemplazar las estimaciones proyectadas de octubre 2026 con los datos reales de ventas de cada seller (ej. Geat, Newsan, cuentas de México y Colombia) y regenerar las proyecciones a futuro (noviembre 2026 a septiembre 2027).
* **Qué se ajustó:**
  * Base de datos: Inserción de registros con `estado = 'REAL'` en la tabla `facturacion`.
  * Modelos de Forecast: Ejecución de recálculo de estacionalidad para regenerar las curvas proyectadas de los 11 meses subsiguientes.

### Punto 6: Registro de Baja de Cliente Abarka al 30/09/2026 (02/11)
* **Qué es:** Cliente **Abarka** en Argentina (`seller_id: 260389278`).
* **Qué se pidió:** El cliente finalizó su vínculo contractual el 30 de septiembre de 2026. No debe aparecer activo ni proyectar facturación para octubre en adelante.
* **Qué se ajustó:**
  * Base de datos: En `dim_sellers` se actualizó `estado = false`.
  * Limpieza de proyecciones: Se eliminaron los registros proyectados posteriores a septiembre 2026 en las tablas `facturacion`, `dim_escalas` y la vista de liquidaciones.

### Punto 7: Actualización de Tipos de Cambio Oficiales Octubre 2026 (02/11)
* **Qué es:** Tabla oficial de tipos de cambio (`dim_tipo_cambio`) de cierre de mes.
* **Qué se pidió:** Actualizar las cotizaciones de cierre del mes de octubre 2026 para todas las divisas operativas frente al Dólar Estadounidense (USD).
* **Qué se ajustó:**
  * Base de datos: Actualización de valores de cierre:
    * **COP (Colombia):** 3.182,99 COP/USD
    * **MXN (México):** 18,81 MXN/USD
    * **ARS (Argentina):** 1.550,00 ARS/USD
    * **CLP (Chile) y PEN (Perú)** actualizados a sus valores de cierre mensual.
  * Todas las conversiones a USD en liquidaciones y reportes ejecutivos tomaron inmediatamente estos tipos de cambio oficiales.

### Punto 8: Actualización de Markup Botmaker al 25% desde Octubre 2026 (02/11)
* **Qué es:** Margen comercial de Reply sobre los costos de plataforma de Botmaker.
* **Qué se pidió:** Hasta el período de septiembre 2026 se aplicaba un markup del **20%** sobre el costo neto de Botmaker. A partir de los servicios de octubre 2026, la política comercial estipula un markup del **25%**.
* **Qué se ajustó:**
  * Base de datos: Creación de migración `10_actualizacion_markup_botmaker_25pct.sql`.
  * Frontend: En [page.tsx](file:///c:/Users/matia/OneDrive/Escritorio/github_reply/administracion/forecast/frontend/src/app/liquidaciones/page.tsx), se aplicó la regla condicional: si `mKey >= '2026-10'`, se calcula `base * 1.25` (o se desglosa el 1.20 histórico y se reajusta a 1.25).

### Punto 9: Regla Comercial de Café Martínez: Descuento 20% y Exclusión Botmaker (02/11)
* **Qué es:** Condiciones comerciales especiales de **Café Martínez** (`seller_id: 1088146491`).
* **Qué se pidió:**
  1. No cobrar Botmaker bajo ningún concepto (`botmaker = $0,00`).
  2. Aplicar un **descuento comercial del 20% mensual** sobre el subtotal de servicio de Reply.
* **Qué se ajustó:**
  * Frontend: Se forzó `botmakerVal = 0` permanentemente.
  * Se agregó una fila específica de color rojo pastel en la tabla: `Descuento Comercial (-20%)` que deduce el 20% del monto de servicio antes de aplicar el IVA del 21% sobre el saldo neto.

### Punto 10: Botmaker en Cuentas del Exterior: Conversión a USD y Pisos Mínimos (USD 170 / 190) (02/11 – 03/11)
* **Qué es:** Liquidación de Botmaker para clientes internacionales (Colombia, México, Chile, USA).
* **Qué se pidió:**
  1. No facturar en pesos sino en Dólares (USD).
  2. Aplicar la regla de piso mínimo:
     * Hasta septiembre 2026 (< 2026-10): piso mínimo de **USD 170,00**.
     * A partir de octubre 2026 (>= 2026-10): piso mínimo de **USD 190,00**.
     * Si el consumo real convertido supera el piso, se cobra el valor real superior.
  3. Ubicar el concepto de Botmaker en una fila independiente debajo del **Subtotal (Ingreso Reply)**, de modo que el total de la factura sea `Subtotal Reply + Botmaker`.
* **Qué se ajustó:**
  * Frontend: Implementación de la fórmula `Math.max(minExteriorUSD, botmakerUSD)` y reestructuración visual de las filas en la tabla.

### Punto 11: Corrección de Paginación en Supabase y Resaltado de Escalas (02/11 – 03/11)
* **Qué es:** Visualización de escalas comerciales vigentes en `/escalas` y fichas de clientes en `/clientes`.
* **Qué se pidió:**
  1. Corregir el corte de registros por el límite por defecto de 1.000 filas de PostgREST, que provocaba que sellers como Geat, Jansport o Axo no mostraran sus escalas o liquidaciones completas.
  2. En Newsan, evitar que se resaltaran múltiples tramos duplicados en la escala.
  3. Mostrar correctamente el estado `REAL` en octubre 2026 en lugar de proyectado para todos los países.
* **Qué se ajustó:**
  * Implementación de helpers de paginación recursiva (`fetchAllLiquidaciones`, `fetchAllEscalas`) con bucles `limit/offset`.
  * Lógica de descarte de duplicados de tiers en la visualización de escalas de Newsan.

### Punto 12: Corrección de Moneda de Cobro a USD en Directorio de Clientes (03/11)
* **Qué es:** Módulo Directorio de Clientes (`/clientes`).
* **Qué se pidió:** Cuentas del exterior como Natura Colombia, Natura México y Go Advance figuraban erróneamente con moneda local (COP / MXN) en la columna de cobro de Reply en lugar de USD.
* **Qué se ajustó:**
  * En [clientes/page.tsx](file:///c:/Users/matia/OneDrive/Escritorio/github_reply/administracion/forecast/frontend/src/app/clientes/page.tsx), se actualizó el mapeo de `moneda_cobro` asignando `USD` de forma estricta para estas cuentas internacionales.

### Punto 13: Evacol Colombia Multicanal: Alta de Dafiti, Cruce en USD y Liquidación en COP (03/11)
* **Qué es:** Consolidado de los 3 canales de **Evacol Colombia** (Mercado Libre: `2219963574`, ADDI: `928424062`, Dafiti: `928424063`).
* **Qué se pidió:**
  1. Dar de alta el canal Dafiti en base de datos.
  2. Escala comercial compartida evaluada en USD (con piso mínimo de **USD 1.000** por marketplace).
  3. Reconversión a Pesos Colombianos (COP) mediante el tipo de cambio oficial mensual (sin IVA por tratarse de facturación en Colombia).
  4. Mostrar en liquidaciones una tabla multicanal explicativa con:
     * Facturación en COP por canal.
     * Total GMV consolidado en COP.
     * Tipo de cambio oficial y cruce en USD.
     * Honorarios por canal en USD.
     * Reflotación a COP y total de la factura consolidada unificada.
  5. Asegurar columnas fijas sticky con ancho estricto de 280px y fondo opaco sólido para que no se transparente el scroll horizontal.
* **Qué se ajustó:**
  * Base de datos: Creación de seller Dafiti y escalas clonadas en `dim_escalas`.
  * Frontend: Construcción del bloque consolidado de 4 secciones para Evacol Colombia en [page.tsx](file:///c:/Users/matia/OneDrive/Escritorio/github_reply/administracion/forecast/frontend/src/app/liquidaciones/page.tsx).

### Punto 14: Pinturas Online: Exclusión Definitiva de Botmaker (03/11)
* **Qué es:** Cuenta **Pinturas Online** en Argentina (`seller_id: 484050606`).
* **Qué se pidió:** "A Pinturas Online No se le cobra botmaker, por más de que esté en la tabla".
* **Qué se ajustó:**
  * Base de datos: Configuración de `cobrar_botmaker = false` en `dim_sellers`.
  * Frontend: Regla condicional en [page.tsx](file:///c:/Users/matia/OneDrive/Escritorio/github_reply/administracion/forecast/frontend/src/app/liquidaciones/page.tsx) para forzar `botmakerVal = 0` sin impactar el subtotal ni el total facturado.

### Punto 15: Liquidación Botmaker Octubre: Alma Nativa, Forbasse, Salvita y Auditoría Nestlé (03/11)
* **Qué es:** Auditoría y ajuste de 4 casos de Botmaker para la facturación de octubre 2026.
* **Qué se pidió y qué se ajustó:**
  1. **Alma Nativa Argentina (`414078026`):**
     * *Pedido:* "a alma nativa argentina, no se le cobra botmaker".
     * *Ajuste:* `cobrar_botmaker = false` en `dim_sellers` y regla de anulación en frontend (`botmakerVal = 0`).
  2. **Forbasse (`3693335392`):**
     * *Pedido:* "El detalle dice Botmaker $ 13.187, pero debemos facturar 206,750 por los servicios de Octubre".
     * *Ajuste:* El registro de `botmaker_consumos` tenía un valor de solo `$10.989,00`. Se actualizó la base a `$165.400,00` para que con el markup del 25% arroje exactamente:
       $$\$165.400,00 \times 1,25 = \$206.750,00$$
  3. **Salvita (`936476007`):**
     * *Pedido:* "En el detalle por concepto no aparece el monto de botmaker: $206.250,00. ¿A Salvita se le cobra botmaker? ¿Tiene info en la base de botmaker para oct/26?".
     * *Diagnóstico:* No tenía ningún registro cargado en `botmaker_consumos` para octubre 2026 y en `dim_sellers` figuraba con `cobrar_botmaker = false`.
     * *Ajuste:* Se activó `cobrar_botmaker = true` y se dio de alta el consumo de octubre con base de `$165.000,00` ($165.000 * 1,25 = $206.250,00), quedando reflejado en liquidaciones.
  4. **Nestlé (`195352434`) — Auditoría previa:**
     * *Pedido:* "cuanto dio botmaker en nestle en octubre? porque me dijeron esto 'Nestle El monto de Botmaker es $410.000,00 y aparece 206,250' pero hay que validarlo antes de cambiar algo, no se debe cambiar sin antes revisar".
     * *Resultado de la auditoría:* En `botmaker_consumos`, el registro de Nestlé para octubre es de `$165.000,00`, lo cual con el 25% de markup da exactamente **$206.250,00**. Los `$410.000,00` pertenecen en realidad a **Soda Stream** (`$328.000 * 1,25 = $410.000,00`). **No se modificó nada en Nestlé** conforme a la instrucción de esperar confirmación.

### Punto 16: Natura México Multicanal: Alta de Amazon, Escalas Compartidas, Botmaker USD 200 y Factura Única (03/11)
* **Qué es:** Liquidación consolidada de **Natura México** (Mercado Libre: `2539005925` y Amazon: `2539005926`).
* **Qué se pidió:**
  1. Dar de alta la cuenta de Amazon (`Natura México Amazon`).
  2. La escala porcentual (de 4,50% a 2,00%) se evalúa sumando la facturación de ambos marketplaces (MELI + Amazon).
  3. El piso mínimo es de **MX$ 30.000** para MELI (canal principal) y **MX$ 24.000** para Amazon (canal adicional).
  4. **Botmaker:** Costo fijo de **USD 200,00 por marca** (se cobra a la marca en la factura unificada, no por canal individual).
  5. Presentar en liquidaciones la factura única en USD con desglose por cuenta y 0% de IVA.
* **Qué se ajustó:**
  * Base de datos:
    * Se renombró `2539005925` a **Natura México ML**.
    * Se creó `2539005926` (**Natura México Amazon**, plataforma `AMAZON`, `id_cliente: 20`, moneda `MXN`, país `MX`).
    * Se crearon 13 períodos en `facturacion` y se clonaron 130 tramos en `dim_escalas` con piso mínimo de MX$ 24.000.
  * Frontend ([page.tsx](file:///c:/Users/matia/OneDrive/Escritorio/github_reply/administracion/forecast/frontend/src/app/liquidaciones/page.tsx)):
    * Implementación del bloque multicanal de Natura México:
      1. Ventas brutas de Mercado Libre, Amazon y Total Consolidado en MXN.
      2. Alícuota evaluada sobre el total consolidado.
      3. Fee por canal respetando los pisos (MX$ 30.000 y MX$ 24.000) y Total Fee en MXN.
      4. Tipo de cambio oficial (TC MXN/USD) y honorarios individuales en USD.
      5. Fila única de Botmaker Fijo Marca (USD $200.00).
      6. IVA 0% (Exportación).
      7. **TOTAL FACTURA FINAL NATURA MÉXICO (USD)**.

### Punto 17: Optimización de UX: Columnas Sticky Opacas y Corrección de Scroll Horizontal (02/11 – 03/11)
* **Qué es:** Comportamiento visual de las tablas de liquidaciones al desplazarse hacia los meses proyectados.
* **Qué se pidió:** Al hacer scroll horizontal, los números de los meses pasaban por detrás de los textos fijos de la izquierda, haciéndose ilegibles debido a clases con opacidad reducida (`bg-.../80`).
* **Qué se ajustó:**
  * Se configuraron todas las columnas sticky izquierdas con:
    * Ancho fijo estricto: `w-[280px] min-w-[280px] max-w-[280px]`
    * Fondos 100% sólidos y opacos (`bg-white`, `bg-amber-100`, `bg-emerald-100`, `bg-blue-100`, `bg-slate-100`)
    * Sombra lateral `shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]` y borde divisor derecho bien contrastado, eliminando completamente el efecto translúcido.

---

## Registro de Commits Git

| Hash | Fecha / Hora (ART) | Mensaje de Commit | Módulos Impactados |
| :--- | :--- | :--- | :--- |
| `58f1857` | 03/11/2026 15:35 | `feat(liquidaciones): reglas comerciales botmaker (alma nativa, forbasse, salvita) y consolidado multicanal natura mexico (meli + amazon)` | Liquidaciones, Botmaker, Natura MX |
| `8ca9a8e` | 03/11/2026 14:50 | `fix(liquidaciones): unificar bloque consolidado evacol colombia con columnas fijas de 280px y fondos solidos opacos` | UI, Evacol Colombia |
| `b24cd2b` | 03/11/2026 14:14 | `fix(pinturas-online): excluir de cobro de botmaker en dim_sellers, vista liquidaciones y frontend` | Pinturas Online, Botmaker |
| `87cd172` | 03/11/2026 13:52 | `feat(evacol): agregar filas explicativas de cruce USD a COP y factura final consolidada de 3 canales` | Evacol Colombia, Escalas |
| `99d828c` | 03/11/2026 13:02 | `fix(liquidaciones): ajustar Botmaker para cuentas del exterior con minimo USD 170/190 y ubicar en fila aparte tras Subtotal` | Liquidaciones Exterior, Botmaker |
| `ec968aa` | 03/11/2026 12:40 | `feat(evacol): dar de alta Evacol Colombia DAFITTI, unificar escalas en USD y liquidación multicanal en COP` | Evacol Dafiti, Base de Datos |
| `207c777` | 03/11/2026 11:41 | `fix(directorio): corregir moneda cobro Reply a USD para Natura CO, Natura MX y Go Advance` | Directorio Clientes |
| `af29be7` | 03/11/2026 11:06 | `fix(botmaker): corregir desfase de 1 mes en consumos y liquidaciones de Botmaker` | Ingesta Botmaker, SQL Views |
| `4939f2c` | 03/11/2026 10:26 | `fix(clientes): paginar fetch de dim_escalas y mostrar escala vigente real en ficha de cliente` | Clientes, Paginación |
| `0120c9d` | 03/11/2026 10:16 | `fix(escalas): corregir resaltado de tiers unicos en Newsan, variaciones Newsan Web, y estado REAL en octubre 2026 para todos los paises` | Escalas, Newsan |
| `7d0bf45` | 02/11/2026 18:39 | `feat(facturacion): registrar facturacion real oct-26 para Geat y actualizar proyecciones` | Facturación Geat |
| `151532d` | 02/11/2026 18:14 | `fix(liquidaciones): eliminar transparencias y agregar bordes en columnas fijas sticky para evitar efecto translúcido al scrollear` | UI Liquidaciones, CSS |
| `c81963b` | 02/11/2026 17:43 | `fix(liquidaciones): convertir botmaker de ARS a USD para cuentas del exterior y sumarlo al subtotal y total en USD` | Liquidaciones Exterior |
| `adacafa` | 02/11/2026 17:20 | `feat(liquidaciones): ajustar markup botmaker a 25pct, aplicar descuento 20pct Cafe Martinez y corregir seleccion de texto y vigencia en Directorio` | Botmaker 25%, Café Martínez |
| `7aa9a3c` | 02/11/2026 16:15 | `Actualizar tipos de cambio reales de oct/26 (ARS, MXN, PEN, CLP, COP) y recálculos asociados` | Tipos de Cambio |
| `5f6c454` | 02/11/2026 15:52 | `feat(abarka): registrar baja del cliente al 30-09-2026, desactivar cuenta y eliminar proyecciones futuras` | Abarka, Bajas |
| `7068b81` | 02/11/2026 15:33 | `fix(escalas): paginar liquidaciones para evitar limite de 1000 filas y corregir celda pintada` | Escalas, Paginación |
| `3a4c5ae` | 02/11/2026 13:38 | `feat(cachafaz): configurar monto fijo de $1.200.000 + IVA para servicios de agosto, septiembre y octubre 2026` | Cachafaz, Escalas |
| `0f0ebfb` | 02/11/2026 13:25 | `feat(facturacion): cargar facturacion real regional oct-26 y regenerar proyecciones para Mexico y Colombia` | Facturación Regional |
| `7082db6` | 02/11/2026 12:42 | `feat(botmaker): update ingest_botmaker to automatically assign consumptions to both consumption and billing liquidation periods` | Ingesta Botmaker |
| `586b132` | 02/11/2026 12:25 | `fix(botmaker): enable cobrar_botmaker flag for active accounts and assign Sep botmaker consumos to Oct-26 liquidations` | Dim Sellers, Botmaker |
| `ffc274b` | 02/11/2026 12:06 | `feat(cachafaz): onboard Cachafaz seller, insert oct-26 real billing and enable daily order sync` | Onboarding Cachafaz |
| `95e17c1` | 02/11/2026 10:52 | `fix(liquidaciones): ampliar limite de registros de Supabase a 5000 y asegurar visibilidad de Grupo Axo en Detalle por Concepto` | Grupo Axo, Paginación |
| `1427e03` | 02/11/2026 10:21 | `feat(axo): implementar modelo de liquidacion y escalas por creditos para Grupo Axo Mexico` | Grupo Axo México, Créditos |
| `1b4a6bb` | 01/11/2026 17:05 | `feat(zaz): aprovisionar cuenta zaz, escalas por inflacion y ordenes reales de octubre` | ZAZ, Onboarding |

---
*Archivo generado automáticamente para auditoría y seguimiento del proyecto Forecast Reply.*
