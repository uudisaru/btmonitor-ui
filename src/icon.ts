const BUS_SVG =
  '<svg width="210mm" height="247mm" viewBox="0 0 210 247" xmlns="http://www.w3.org/2000/svg"><defs><clipPath clipPathUnits="userSpaceOnUse" id="a"><path d="M0 0h9578v11642H0z"/></clipPath></defs><g class="SlideGroup" fill-rule="evenodd" stroke-width="28.222" stroke-linejoin="round"><g clip-path="url(#a)" class="Slide" transform="matrix(.01343 0 0 .0174 45.428 38.075)"><g class="Page"><g class="Graphic"><path d="M0 4241h9578v7401H0z" class="BoundingBox" fill="none"/><path d="M766 6576l471-1162 1041-668 5186 12 825 649 587 1258 85 3286-8189-178z" fill="#fff"/><path d="M1298 11578c-120-33-254-116-325-200-51-60-58-101-67-370-7-204-20-307-40-315-17-7-195-13-395-13H106l8-1577 8-1577 230-1093c126-601 248-1132 270-1178 60-126 229-281 404-369 178-91 643-238 947-301 281-57 790-134 1230-185 1194-139 2169-132 3429 25 1442 178 2162 426 2364 812 37 70 129 469 279 1204l225 1100v3139h-351c-193 0-364 6-381 13-20 8-34 110-41 306-13 341-38 400-221 502-351 196-966 104-1093-164-17-37-30-181-30-334 0-224-7-275-41-297-38-24-303-26-2525-26s-2487 2-2525 26c-34 22-41 75-41 307-1 260-5 287-63 365-74 100-148 145-308 192-145 42-443 46-582 8zm505-1880c251-57 425-215 425-385 0-237-278-416-645-416-182 0-292 26-427 101-154 86-213 173-213 311 0 131 54 217 188 297 170 103 453 142 672 92zm6534-23c478-154 478-578 0-732-339-109-749-15-895 206-59 90-50 252 19 343 156 205 552 287 876 183zm53-1838c78-9 168-33 201-52 65-39 116-164 98-242-6-28-93-426-194-886-188-860-208-919-340-995-136-78-71-77-3320-78-2197 0-3097 5-3182 19-156 25-265 96-314 205-65 146-415 1788-395 1856 26 90 138 160 277 174 190 19 7007 19 7169-1zM6814 5214c122-18 190-63 214-143 21-71-47-165-137-191-47-14-633-19-2095-19-1883 0-2033 2-2086 29-124 64-149 162-63 252 31 32 82 58 125 64 41 6 86 13 100 16 65 14 3847 6 3942-8z"/></g></g></g></g><text style="line-height:1.25" x="-2.901" y="91.022" transform="scale(1.00346 .99655)" font-weight="400" font-size="13.571" font-family="sans-serif" letter-spacing="0" word-spacing="0" stroke-width=".339"><tspan x="-2.901" y="91.022" style="font-variant-ligatures:normal;font-variant-caps:normal;font-variant-numeric:normal;font-feature-settings:normal;text-align:start" font-size="108.569">48</tspan></text></svg>';
const BUS_SVGS = [
  BUS_SVG.replace(/x="-2.901"/gi, 'x="80.901"'),
  BUS_SVG.replace(/x="-2.901"/gi, 'x="40.901"'),
  BUS_SVG
];
const LINE_NO_INDEX = BUS_SVG.indexOf('>48</tspan>') + 1;

export function buildSvg(line: string): HTMLImageElement {
  const index = line.length > 2 ? 2 : line.length - 1;
  let svg = BUS_SVGS[index];
  svg = svg.slice(0, LINE_NO_INDEX) + line + svg.slice(LINE_NO_INDEX + 2);
  var svgImage = new Image();
  svgImage.src = 'data:image/svg+xml,' + escape(svg);
  return svgImage;
}
