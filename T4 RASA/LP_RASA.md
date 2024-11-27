# README - Trabajo de Corrección y Formateo de Datos

## Objetivo:
Este trabajo fue uno de los más complicados, pero al final todo se resolvió con paciencia y la marcha. En este proceso, se realizaron varias correcciones y ajustes en las columnas para mantener el orden, corregir los precios y asegurarse de que todo estuviera acorde con el modelo proporcionado.

---

## Pasos realizados:

### 1. **Arreglo del desorden en las columnas**:
   - Al principio, las columnas estaban desordenadas, lo que dificultaba la lectura de los datos. Se hizo un **reordenamiento de las columnas** para garantizar que los datos estuvieran en el orden correcto y fueran fáciles de trabajar.

### 2. **Fijar el encabezado para mantener el orden**:
   - Para asegurar que las cabeceras estuvieran siempre visibles y se mantuviera el orden adecuado, se **fijaron las cabeceras** en la parte superior de la hoja. Esto nos permitió navegar por la hoja de manera más eficiente sin perder de vista las cabeceras importantes.

### 3. **Unir la información de las columnas A y B**:
   - Se necesitaba combinar la información de la columna **A** (Código) y la columna **B** (Descripción) en una sola celda. Para hacer esto, se utilizó el siguiente comando en una nueva columna (por ejemplo, **C**):
   
     ```excel
     =A2 & " " & B2
     ```
   - Este comando **unió el código y la descripción** en una sola celda, con un espacio entre ellos, lo que facilitó la lectura y organización de la información.

### 4. **Modificación de la columna de precios**:
   - En la columna de **Precio**, se realizó la corrección para que los valores se mostraran como **números enteros**, sin decimales, como se solicitó. Para ello, se aplicó el formato de **"Número"** a la columna de precios, lo que permitió quitar los decimales innecesarios y ajustar los valores al formato correcto.

### 5. **Eliminación de caracteres extraños**:
   - Se encontró que algunos precios contenían caracteres no deseados, como **`\xe2\x86\x92`**, que eran representaciones codificadas. Estos caracteres fueron **eliminados** para limpiar los datos y asegurarnos de que la información fuera coherente y fácil de leer.

### 6. **Controlar que las cabeceras queden iguales al modelo anterior**:
   - Se revisaron las cabeceras para asegurarse de que coincidieran con el modelo de ejemplo proporcionado. Esto garantizó que todas las columnas estuvieran correctamente etiquetadas, manteniendo la consistencia con los requisitos previos.

### 7. **Revisión de los precios**:
   - Los precios fueron revisados cuidadosamente para asegurarse de que coincidieran con los valores del modelo anterior. Esto incluyó verificar la exactitud de los valores y asegurarse de que estuvieran bien formateados.

---

## Resultado Final:
- **La columna de códigos** (A) ahora contiene solo **números enteros**, como se solicitó.
- **La columna de precios** se corrigió y los valores se mostraron como números enteros sin decimales, ajustados según el modelo.
- Se unieron los valores de las columnas **A** y **B** en una nueva columna utilizando la fórmula `=A2 & " " & B2`, lo que facilitó la visualización de la información.
- Se eliminaron los caracteres extraños, dejando los datos limpios y bien organizados.
- Las cabeceras fueron corregidas para alinearse con el modelo original, y se revisaron los precios para asegurar su exactitud.

---

## Herramientas Utilizadas:
- **Google Sheets** para realizar todas las operaciones y correcciones.
- **Fórmulas** como `=A2 & " " & B2` para combinar columnas.
- **Formato de número** para ajustar los precios y eliminar decimales.

---

Este fue un proceso desafiante, pero al final el trabajo quedó prolijo, ordenado y acorde a los requisitos solicitados. Gracias a la herramienta **Google Sheets** y el uso de fórmulas y formatos adecuados, todo se resolvió de manera efectiva y eficiente.

