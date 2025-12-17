varying vec3 vColor;

void main() {
  // Circular particle
  vec2 coord = gl_PointCoord - vec2(0.5);
  if(length(coord) > 0.5) discard;
  
  gl_FragColor = vec4(vColor, 1.0);
}
