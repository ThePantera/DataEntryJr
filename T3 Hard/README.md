# README - Proceso de Corrección de Precios y Mejoras Estéticas

## Objetivo:
El objetivo de este proceso fue corregir los precios en la columna **F**, que contenían dígitos adicionales (decimales innecesarios), y ajustar los valores en la columna **G** de acuerdo al modelo proporcionado, eliminando esos decimales y dejando los precios correctos. Para ello, se utilizó la fórmula `=F2*100` en una columna auxiliar, la cual fue eliminada una vez realizados los ajustes.

---

## Pasos realizados:

### 1. **Corregir los valores en la columna F utilizando `=F2*100`**:
   - Los precios en la columna **F** venían con dígitos de más, es decir, los valores tenían decimales adicionales que no correspondían al formato requerido.
   - Para corregir los valores de la columna **F**, se utilizó la fórmula `=F2*100`, lo que multiplicó cada valor por 100, eliminando los decimales y convirtiendo los precios a números enteros.
   
   **Ejemplo**:
   - Si el valor en **F2** era **729751.37**, al aplicar la fórmula `=F2*100`, el valor se transformó en **72975137**.
   - Este proceso se aplicó a todas las filas necesarias de la columna **F**.

### 2. **Columna auxiliar para aplicar la fórmula**:
   - Se creó una **columna auxiliar (por ejemplo, G)** en la que se aplicó la fórmula `=F2*100` para obtener los valores corregidos de manera rápida y efectiva.
   - La fórmula fue arrastrada hacia abajo para cubrir todas las celdas relevantes en la columna **G**.

### 3. **Reemplazo de los valores originales en la columna F**:
   - Una vez corregidos los precios en la columna **G**, los valores de la columna **F** fueron reemplazados por los valores corregidos de **G**.
   - Se utilizó la opción **Pegado especial > Pegar solo valores** para reemplazar los valores originales sin mantener las fórmulas.
   
   **Nota**: La columna auxiliar **G** fue eliminada después de que se hizo el reemplazo, ya que su propósito ya había sido cumplido.

---

## Mejoras Estéticas Realizadas:

### 1. **Formato de celdas**:
   - Se aplicaron **colores suaves en el fondo** para hacer que la hoja de cálculo fuera más visualmente atractiva y fácil de leer.
   - Las celdas de las cabeceras fueron destacadas en **negrita** para darles un mayor contraste y asegurar que fueran fácilmente identificables.

### 2. **Resaltado de filas**:
   - Se aplicó un **color de fondo alternado en las filas** para mejorar la legibilidad, facilitando la visualización de los datos cuando se tiene una lista larga de artículos.

### 3. **Ajuste de alineación y tamaño de celdas**:
   - Se ajustó el **ancho de las columnas** para asegurar que el contenido encajara correctamente sin desbordarse.
   - También se alinearon los precios a la **derecha** y las descripciones a la **izquierda**, para una presentación más clara y ordenada.

### 4. **Resultado estético final**:
   - El resultado final es una hoja mucho más prolija, con un formato claro y visualmente atractivo.
   - El uso d
