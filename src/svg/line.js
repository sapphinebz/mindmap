// const template = document.createElement("template");
// template.innerHTML = `
// <svg
// version="1.1"
// width="500"
// height="500"
// xmlns="http://www.w3.org/2000/svg"
// >

// </svg>
// `;

// export function createLine() {
//   const fm = template.content.cloneNode(true);
//   const svgElement = fm.querySelector("svg");
//   const newLine = document.createElementNS(
//     "http://www.w3.org/2000/svg",
//     "line"
//   );
//   newLine.setAttribute("id", "line2");
//   newLine.setAttribute("stroke", "orange");
//   newLine.setAttribute("stroke-width", "5");
//   svgElement.append(newLine);
//   return svgElement;
// }

export function calculateDegLine(mousedown, mousemove) {
  const deg = calculateDeg(mousedown, mousemove);
  let degree = deg < 0 ? deg + 360 : deg;
  return degree;
}

export function calculateDeg(mousedown, mousemove) {
  if (mousemove.x > mousedown.x) {
    return (
      (Math.atan((mousemove.y - mousedown.y) / (mousemove.x - mousedown.x)) *
        180) /
      Math.PI
    );
  } else if (mousemove.x < mousedown.x && mousemove.y > mousedown.y) {
    let degree =
      (Math.atan((mousedown.x - mousemove.x) / (mousemove.y - mousedown.y)) *
        180) /
      Math.PI;

    degree += 90;
    return degree;
  } else if (mousemove.x < mousedown.x && mousemove.y < mousedown.y) {
    let degree =
      (Math.atan((mousedown.y - mousemove.y) / (mousedown.x - mousemove.x)) *
        180) /
      Math.PI;
    degree += 180;
    return degree;
  } else if (mousemove.x === mousedown.x && mousemove.y > mousedown.y) {
    return 90;
  } else if (mousemove.x === mousedown.x && mousemove.y < mousedown.y) {
    return 270;
  } else if (mousemove.x > mousedown.x && mousemove.y === mousedown.y) {
    return 0;
  } else if (mousemove.x < mousedown.x && mousemove.y === mousedown.y) {
    return 180;
  }

  return 0;
}
