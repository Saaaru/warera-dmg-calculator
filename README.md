# 🎯 Warera Damage Calculator

## 📋 Descripción General

**Warera Damage Calculator** es una herramienta web avanzada diseñada para simular y analizar el rendimiento de builds de personajes en el juego Warera. Permite a los jugadores crear, probar y comparar diferentes configuraciones de equipamiento y habilidades para optimizar su daño en combate.

## 🎮 ¿Qué hace esta web?

### Funcionalidades Principales

1. **🏗️ Gestión de Builds**
   - Creación y personalización de builds de personajes
   - Sistema de presets para guardar y cargar configuraciones
   - Gestión de equipamiento (armas, armaduras, consumibles)
   - Asignación de puntos de habilidad

2. **⚔️ Simulación de Combate**
   - Simulación de golpes individuales con cálculos detallados
   - Análisis completo de ciclos de combate (hasta 2000 ticks)
   - Simulación Monte Carlo con múltiples iteraciones
   - Cálculo de estadísticas de rendimiento

3. **📊 Análisis Avanzado**
   - Comparación directa entre dos builds
   - Métricas de rendimiento detalladas
   - Gráficos visuales de comparación
   - Análisis de consistencia y factores limitantes

4. **🔗 Integración con el Juego**
   - Carga de datos desde la API del juego
   - Exportación de builds para uso en el juego
   - Sincronización de estadísticas de personaje

## 🧮 Cómo realiza los cálculos

### Sistema de Estadísticas Base

El calculador maneja 7 estadísticas principales:

- **🗡️ Attack (Ataque)**: Daño base del personaje
- **🎯 Precision (Precisión)**: Probabilidad de golpear
- **💥 Critical Chance (Probabilidad Crítica)**: Chance de golpe crítico
- **🔥 Critical Damages (Daño Crítico)**: Multiplicador de daño crítico
- **🛡️ Armor (Armadura)**: Reducción de daño recibido
- **🌀 Dodge (Esquiva)**: Probabilidad de esquivar ataques
- **📦 Loot Chance (Probabilidad de Loot)**: Chance de obtener items

### Fórmulas de Cálculo

#### 1. **Cálculo de Estadísticas Totales**
```javascript
// Cada estadística se calcula como:
Total = (Valor Base de Habilidad × Factor Aleatorio) + Equipamiento + Buffs

// Factor aleatorio: 0.9x - 1.1x (aplicado globalmente para consistencia)
```

#### 2. **Cálculo de Daño por Tick**
```javascript
// 1. Verificación de esquiva
if (Math.random() * 100 < dodgeStats.total) {
    healthLost = 0; // Esquiva exitosa
} else {
    // 2. Reducción por armadura
    damageReduction = healthLost * (armorStats.total / 100);
    healthLost -= damageReduction;
}

// 3. Cálculo de daño de ataque
baseDamage = attackStats.total;

// 4. Verificación de precisión
if (Math.random() * 100 >= precisionStats.total) {
    baseDamage /= 2; // Golpe parcial
}

// 5. Verificación de golpe crítico
if (Math.random() * 100 < critChanceStats.total) {
    critMultiplier = 1 + (critDamageStats.total / 100);
    finalDamage = baseDamage * critMultiplier;
} else {
    finalDamage = baseDamage;
}
```

#### 3. **Simulación de Combate Completo**
```javascript
// Para cada tick (máximo 2000):
while (ticksSurvived < MAX_TICKS) {
    // 1. Lógica de curación con comida
    if (health <= incomingDamage && hunger > 0) {
        while (hunger > 0 && health <= incomingDamage) {
            hunger--;
            health += healthPerFood;
        }
    }
    
    // 2. Verificación de capacidad de ataque
    if (health < incomingDamage) break;
    
    // 3. Ejecución del tick de combate
    tickResult = simulateCombatTick();
    health -= tickResult.healthLost;
    totalDamage += tickResult.finalDamageDealt;
    ticksSurvived++;
    
    // 4. Verificación de fin de combate
    if (health <= 0) break;
}
```

### Simulación Monte Carlo

Para análisis estadísticos robustos, el sistema ejecuta múltiples simulaciones:

```javascript
// Ejecuta 'iterations' simulaciones (por defecto 1000)
for (let i = 0; i < iterations; i++) {
    result = runSingleSimulation();
    damageResults.push(result.totalDamageDealt);
    ticksResults.push(result.ticksSurvived);
    endReasonCounts[result.endReason]++;
}

// Calcula estadísticas
damageStats = calculateStatistics(damageResults);
ticksStats = calculateStatistics(ticksResults);
```

## 🔍 Cómo maneja las comparaciones

### Sistema de Comparación de Builds

#### 1. **Preparación de Builds**
- **Build A**: Configuración actual del personaje
- **Build B**: Preset cargado desde el sistema de guardado
- Ambos builds se ejecutan con los mismos parámetros de simulación

#### 2. **Métricas de Comparación**

**Métricas Principales:**
- **TDC (Total Damage Cumulative)**: Daño total promedio
- **THC (Total Hits Cumulative)**: Número promedio de golpes
- **DPH (Damage Per Hit)**: Daño promedio por golpe
- **Consistency**: Consistencia del daño (desviación estándar)

**Métricas Secundarias:**
- **Rango de daño**: Mínimo y máximo observado
- **Factor limitante**: Razón principal del fin de combate
- **Factor aleatorio**: Multiplicador aplicado en la simulación

#### 3. **Proceso de Comparación**
```javascript
// 1. Ejecutar simulación Monte Carlo para Build A
buildAResults = runMonteCarloSimulation(runs, buildA, foodItem);

// 2. Ejecutar simulación Monte Carlo para Build B
buildBResults = runMonteCarloSimulation(runs, buildB, foodItem);

// 3. Calcular diferencias porcentuales
damageDifference = ((buildB.avgDamage - buildA.avgDamage) / buildA.avgDamage) * 100;
hitsDifference = ((buildB.avgHits - buildA.avgHits) / buildA.avgHits) * 100;

// 4. Generar visualización
renderComparisonChart(buildAResults, buildBResults);
```

#### 4. **Visualización de Resultados**
- **Tarjetas de comparación**: Muestra métricas lado a lado
- **Gráfico de barras**: Comparación visual de rendimiento
- **Análisis de diferencias**: Cálculo de mejoras/empeoramientos porcentuales

## 🎯 Características Técnicas

### Arquitectura del Sistema

- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Módulos**: Sistema modular con separación de responsabilidades
- **Estado**: Gestión centralizada del estado del personaje
- **Persistencia**: LocalStorage para presets y configuraciones

### Optimizaciones

- **Factor aleatorio global**: Consistencia en simulaciones individuales
- **Simulación ligera**: Optimizada para múltiples iteraciones
- **Caché de elementos DOM**: Mejora del rendimiento de la interfaz
- **Lazy loading**: Carga de datos bajo demanda

### Configuración de Simulación

- **Iteraciones**: 100-5000 runs (configurable)
- **Items de comida**: Bread (5 HP), Steak (10 HP), Cooked Fish (15 HP)
- **Daño entrante**: 10 HP por tick
- **Ticks máximos**: 2000 por simulación
- **Factor aleatorio**: 0.9x - 1.1x por simulación

## 🚀 Uso de la Aplicación

### Inicio Rápido
1. Abre `index.html` en tu navegador
2. Configura tu personaje con equipamiento y habilidades
3. Ejecuta una simulación básica con "Single Hit"
4. Analiza el rendimiento completo con "Full Combat Analysis"

### Comparación de Builds
1. Guarda tu build actual como preset
2. Modifica tu configuración para crear un build alternativo
3. Carga el preset anterior en "Build B"
4. Ejecuta "Compare Builds" para análisis detallado

### Carga desde el Juego
1. Ingresa tu Player ID o URL de perfil
2. Haz clic en "Fetch Data" para cargar datos del juego
3. Los datos se sincronizarán automáticamente

## 📁 Estructura del Proyecto

```
warera-dmg-calculator/
├── dmg-calculator/
│   ├── index.html              # Página principal
│   ├── src/
│   │   ├── main.js             # Lógica principal y eventos
│   │   ├── calculator.js       # Cálculos y simulaciones
│   │   ├── state.js            # Gestión del estado
│   │   └── ui.js               # Interfaz de usuario
│   └── public/
│       ├── data/
│       │   └── skills.json     # Datos de habilidades
│       ├── images/             # Iconos y assets
│       └── styles/
│           └── style.css       # Estilos CSS
```

## 🔧 Desarrollo

### Ejecutar Localmente
```bash
cd dmg-calculator
python -m http.server 8000
# Abrir http://localhost:8000
```

### Tecnologías Utilizadas
- **HTML5**: Estructura semántica y accesible
- **CSS3**: Grid y Flexbox para layouts responsivos
- **JavaScript ES6+**: Módulos, async/await, destructuring
- **Canvas API**: Gráficos de comparación
- **LocalStorage API**: Persistencia de datos

## 📈 Métricas y KPIs

### Indicadores de Rendimiento
- **TDC (Total Damage Cumulative)**: Métrica principal de daño
- **THC (Total Hits Cumulative)**: Durabilidad en combate
- **DPH (Damage Per Hit)**: Eficiencia de daño
- **Consistency**: Estabilidad del rendimiento

### Factores Limitantes
- **No Health**: Agotamiento de vida
- **Weapon Broken**: Rotura del arma
- **Max Ticks**: Límite de tiempo alcanzado

## 🎯 Casos de Uso

### Para Jugadores
- Optimización de builds para diferentes situaciones
- Comparación de equipamiento antes de comprar
- Análisis de la eficacia de diferentes estrategias
- Planificación de progresión de habilidades

### Para Desarrolladores
- Testing de balance de juego
- Análisis de metagame
- Validación de fórmulas de daño
- Optimización de sistemas de combate

---

**Warera Damage Calculator** proporciona una herramienta completa y precisa para el análisis de builds, permitiendo a los jugadores tomar decisiones informadas sobre su progresión y equipamiento en el juego.
