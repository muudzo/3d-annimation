varying vec3 vColor;

void main() {
    // Calculate distance from center of the point (0.5, 0.5)
    float d = distance(gl_PointCoord, vec2(0.5));
    
    // Discard pixels outside the circle
    if (d > 0.5) discard;
    
    // Soft glow effect: 1.0 at center, fading out
    float alpha = 1.0 - pow(d * 2.0, 2.0); // Quadratic falloff
    
    gl_FragColor = vec4(vColor, alpha);
}
