uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;

attribute float aScale;
attribute vec3 aColor;

varying vec3 vColor;

void main() {
    vColor = aColor;
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size attenuation
    gl_PointSize = uSize * aScale * uPixelRatio;
    gl_PointSize *= (1.0 / -mvPosition.z);
}
