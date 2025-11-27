export const SHADERS = {
    line: {
        vertex: `
            attribute float alpha;
            attribute float side;
            attribute float progress;
            varying float vAlpha;
            varying float vSide;
            varying float vProgress;
            void main() {
                vAlpha = alpha;
                vSide = side;
                vProgress = progress;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragment: `
            uniform vec3 color;
            uniform float opacityMultiplier;
            varying float vAlpha;
            varying float vSide;
            varying float vProgress;

            float rand(vec2 co){
                return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
            }

            void main() {
                float noise1 = rand(vec2(vSide * 0.5, vProgress * 20.0));
                float layer1 = 0.5 + 0.5 * sin(vSide * 2.0 + noise1 * 2.0);
                
                float noise2 = rand(vec2(vSide * 5.0, vProgress * 100.0));
                float layer2 = 0.5 + 0.5 * sin(vSide * 10.0 + noise2 * 5.0);
                
                float combined = mix(layer1, layer2, 0.3);
                
                float intensity = 0.8 + 0.4 * rand(vec2(vProgress * 10.0, 0.0));
                
                float finalAlpha = vAlpha * opacityMultiplier; 
                if (finalAlpha > 1.0) finalAlpha = 1.0;
                
                // Match origin color (solid).
                // If opacityMultiplier is high (> 2.5), we render a solid line (Page 2).
                // If it's low (~2.0), we keep the texture (Page 1).
                float noise = pow(combined, 0.8) * intensity;
                
                float solidness = clamp((opacityMultiplier - 2.5) / 1.0, 0.0, 1.0);
                float effectiveNoise = mix(noise, 1.0, solidness);
                
                gl_FragColor = vec4(color, finalAlpha * effectiveNoise);

                #include <encodings_fragment>
            }
        `
    }
};
