uniform sampler2D uPositionTexture;
uniform float uTime;

varying vec3 vColor;

void main() {
  // Read position from GPGPU texture
  // Texture coordinates are passed in the position attribute of the geometry
  // Wait, we need a reference attribute (UVs) for each particle index
  // Each vertex = 1 particle. 
  // We use 'position' as the reference UV if we construct the geometry that way.
  vec3 pos = texture2D(uPositionTexture, position.xy).xyz;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Size attenuation
  // M1 Optimization: Keep points visible but efficient
  gl_PointSize = 4.0 * (1.0 / -mvPosition.z);

  // Color flair based on position/movement
  // Since we don't have explicit velocity, we use position delta (noise flow) or just position
  // Let's make them colorful
  vec3 colorA = vec3(0.2, 0.5, 1.0);
  vec3 colorB = vec3(1.0, 0.2, 0.5);
  
  float speed = length(pos) * 0.5; // proxy
  vColor = mix(colorA, colorB, sin(speed + uTime) * 0.5 + 0.5);
}
