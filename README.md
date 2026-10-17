# CuadernoControl

CuadernoControl es una aplicación web local para organizar tareas y registrar notas de trabajo. Presenta el avance de las tareas en un panel y permite consultar y filtrar actividades desde el navegador.

## Funcionalidades

- Crear, editar, completar y eliminar tareas.
- Asignar estado, prioridad, etapa y fecha límite.
- Buscar tareas y filtrarlas por estado.
- Consultar estadísticas y progreso calculados a partir de las tareas guardadas.
- Crear y eliminar notas en la bitácora.
- Navegar entre el panel, las tareas, el resumen del proyecto y la bitácora.
- Usar un diseño adaptable en pantallas de escritorio y móviles.
- Validar campos y mostrar avisos ante errores de almacenamiento.

## Tecnologías

- HTML5
- CSS3
- JavaScript nativo
- `localStorage` para guardar tareas y notas en el navegador

No requiere dependencias ni proceso de compilación.

## Instalación y ejecución

1. Descarga o clona el proyecto y abre la carpeta `CuadernoControl`.
2. Abre `index.html` directamente en un navegador moderno. También puedes servir la carpeta con una extensión de servidor estático, como Live Server en VS Code.
3. Crea tareas o notas. Los cambios se guardan automáticamente en el almacenamiento local del navegador.

## Límites y limitaciones conocidas

- Los datos se guardan en el navegador y perfil donde se crearon. No hay cuentas, servidor, sincronización entre dispositivos ni copia de seguridad incorporada.
- Borrar los datos del navegador puede eliminar las tareas y notas guardadas.
- Cada colección admite hasta 1.000 registros. Los títulos admiten hasta 120 caracteres para tareas y 100 para notas; las descripciones admiten hasta 2.000 caracteres para tareas y 5.000 para notas.
- Los datos inválidos o duplicados encontrados durante la carga se descartan. Los datos dañados no se pueden reconstruir automáticamente.
- El resumen de proyecto muestra el progreso derivado de las tareas; no incluye gestión independiente de varios proyectos.
- El proyecto no tiene una suite automatizada de pruebas configurada.
