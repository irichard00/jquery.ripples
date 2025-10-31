/**
 * DotLightRipple - Light energy ripple effect with illuminated dots
 * Creates a particle-based ripple effect where stationary dots are lit up
 * by energy waves passing through them
 */

class DotLightRipple {
    constructor(options = {}) {
        // Default options
        this.options = {
            dotSpacing: options.dotSpacing || 10, // Spacing between dots in pixels (100% more dense)
            dotBaseSize: options.dotBaseSize || 1, // Base size of dots when lit (1 pixel)
            dotMaxSize: options.dotMaxSize || 1, // Maximum size at peak brightness (1 pixel)
            waveSpeed: options.waveSpeed || 300, // Pixels per second
            waveFadeDistance: options.waveFadeDistance || 600, // Distance over which wave fades (75% of 800)
            backgroundColor: options.backgroundColor || 'rgba(0, 0, 0, 0)', // Fully transparent background
            dotColor: options.dotColor || [255, 255, 255], // RGB for dot color (bright white)
            glowColor: options.glowColor || [255, 255, 255], // RGB for glow color (white)
            shadowColor: options.shadowColor || [0, 0, 0], // RGB for shadow color (dark)
            ...options
        };

        // State
        this.visible = false;
        this.destroyed = false;
        this.undulating = false;
        this.ripples = []; // Active ripples
        this.dots = []; // Grid of dot positions
        this.lastTime = performance.now();

        // Create overlay canvas
        this._createCanvas();
        this._initializeDots();

        // Start animation loop
        this._startAnimation();
    }

    _createCanvas() {
        // Create overlay canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '9999';
        this.canvas.style.display = 'none';

        document.body.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');

        this._updateSize();

        // Handle window resize
        this._resizeHandler = () => {
            this._updateSize();
            this._initializeDots();
        };
        window.addEventListener('resize', this._resizeHandler);
    }

    _updateSize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    _initializeDots() {
        // Create a grid of dot positions
        this.dots = [];
        const spacing = this.options.dotSpacing;

        for (let x = spacing / 2; x < this.canvas.width; x += spacing) {
            for (let y = spacing / 2; y < this.canvas.height; y += spacing) {
                // Add some random offset to make it look more organic
                const offsetX = (Math.random() - 0.5) * spacing * 0.3;
                const offsetY = (Math.random() - 0.5) * spacing * 0.3;

                this.dots.push({
                    x: x + offsetX,
                    y: y + offsetY,
                    baseX: x + offsetX,
                    baseY: y + offsetY
                });
            }
        }
    }

    _startAnimation() {
        const animate = (currentTime) => {
            if (!this.destroyed) {
                const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
                this.lastTime = currentTime;

                this._step(deltaTime);
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    }

    _step(deltaTime) {
        if (!this.visible) {
            return;
        }

        // Update ripples
        this._updateRipples(deltaTime);

        // Render
        this._render();
    }

    _updateRipples(deltaTime) {
        // Update each ripple's radius
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const ripple = this.ripples[i];
            ripple.radius += this.options.waveSpeed * deltaTime;

            // Remove ripples that have faded completely
            if (ripple.radius > ripple.maxRadius) {
                this.ripples.splice(i, 1);
            }
        }
    }

    _render() {
        const ctx = this.ctx;

        // Clear canvas completely (for transparency)
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Calculate brightness for each dot based on all active ripples
        const dotBrightness = new Map(); // Map dot index to brightness

        this.dots.forEach((dot, index) => {
            let maxBrightness = 0;
            let maxSize = 0;

            // Check each ripple's influence on this dot
            this.ripples.forEach(ripple => {
                const dx = dot.x - ripple.x;
                const dy = dot.y - ripple.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Calculate how close the ripple wave front is to this dot
                const distanceFromWaveFront = Math.abs(distance - ripple.radius);

                // Brightness decreases with distance from wave front
                // and also decreases as the ripple expands (fading over time)
                const frontBrightness = Math.max(0, 1 - distanceFromWaveFront / 30);
                const fadeFactor = Math.max(0, 1 - ripple.radius / ripple.maxRadius);

                let brightness = frontBrightness * fadeFactor * ripple.strength;

                // Apply easing for smoother effect
                brightness = this._easeOutCubic(brightness);

                if (brightness > maxBrightness) {
                    maxBrightness = brightness;
                    // Size increases with brightness
                    maxSize = this.options.dotBaseSize +
                             (this.options.dotMaxSize - this.options.dotBaseSize) * brightness;
                }
            });

            if (maxBrightness > 0.01) { // Only draw if brightness is significant
                dotBrightness.set(index, { brightness: maxBrightness, size: maxSize });
            }
        });

        // Render lit dots
        dotBrightness.forEach((data, index) => {
            const dot = this.dots[index];
            this._drawDot(dot.x, dot.y, data.size, data.brightness);
        });
    }

    _drawDot(x, y, size, brightness) {
        const ctx = this.ctx;
        const [r, g, b] = this.options.dotColor;
        const [gr, gg, gb] = this.options.glowColor;
        const [sr, sg, sb] = this.options.shadowColor;

        // Draw dark shadow for visibility on light backgrounds
        const shadowRadius = size * 4;
        const shadowGradient = ctx.createRadialGradient(x, y, 0, x, y, shadowRadius);
        shadowGradient.addColorStop(0, `rgba(${sr}, ${sg}, ${sb}, ${brightness * 0.6})`);
        shadowGradient.addColorStop(0.4, `rgba(${sr}, ${sg}, ${sb}, ${brightness * 0.3})`);
        shadowGradient.addColorStop(1, `rgba(${sr}, ${sg}, ${sb}, 0)`);

        ctx.fillStyle = shadowGradient;
        ctx.beginPath();
        ctx.arc(x, y, shadowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw white glow effect
        const glowRadius = size * 3;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
        gradient.addColorStop(0, `rgba(${gr}, ${gg}, ${gb}, ${brightness * 0.9})`);
        gradient.addColorStop(0.3, `rgba(${gr}, ${gg}, ${gb}, ${brightness * 0.5})`);
        gradient.addColorStop(1, `rgba(${gr}, ${gg}, ${gb}, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw bright white center dot
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    _easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    // Public API

    /**
     * Turn on the ripple effect
     */
    turnOn() {
        this.visible = true;
        this.canvas.style.display = 'block';
    }

    /**
     * Turn off the ripple effect
     */
    turnOff() {
        this.visible = false;
        this.canvas.style.display = 'none';
        this.ripples = []; // Clear active ripples
    }

    /**
     * Create a light energy ripple at specific coordinates
     * @param {number} x - X coordinate in pixels
     * @param {number} y - Y coordinate in pixels
     * @param {number} strength - Optional strength (default: 1.0)
     * @param {number} maxRadius - Optional max radius (default: waveFadeDistance)
     */
    drop(x, y, strength, maxRadius) {
        strength = strength !== undefined ? strength : 1.0;
        maxRadius = maxRadius || this.options.waveFadeDistance;

        this.ripples.push({
            x: x,
            y: y,
            radius: 0,
            maxRadius: maxRadius,
            strength: strength
        });

        if (!this.visible) {
            this.turnOn();
        }
    }

    /**
     * Create a one-time burst of random ripples across the page that fade out naturally
     */
    undulate() {
        if (this.undulating) {
            return; // Already undulating
        }

        this.undulating = true;

        if (!this.visible) {
            this.turnOn();
        }

        const width = this.canvas.width;
        const height = this.canvas.height;
        const numRipples = 20;
        const maxDelay = 500; // 0.5 seconds range for staggering

        // Generate random points and trigger them with staggered timing
        for (let i = 0; i < numRipples; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const delay = Math.random() * maxDelay;
            const strength = 0.8 + Math.random() * 0.4; // Random strength between 0.8-1.2 (brighter)
            const maxRadius = this.options.waveFadeDistance; // Use default fade distance

            setTimeout(() => {
                if (this.undulating) {
                    this.drop(x, y, strength, maxRadius);
                }
            }, delay);
        }

        // After all ripples are triggered, mark undulation as complete and let them fade naturally
        // The fade duration is longer to let ripples fully dissipate
        setTimeout(() => {
            this.undulating = false;
            // Ripples will naturally fade due to the distance-based fade logic
        }, maxDelay + 3000); // Wait for all ripples to trigger + 3 seconds to fade
    }

    /**
     * Create a pulse effect - expanding rings from center
     * @param {number} x - X coordinate in pixels (default: center)
     * @param {number} y - Y coordinate in pixels (default: center)
     * @param {number} numWaves - Number of waves (default: 5)
     */
    pulse(x, y, numWaves = 5) {
        x = x !== undefined ? x : this.canvas.width / 2;
        y = y !== undefined ? y : this.canvas.height / 2;

        if (!this.visible) {
            this.turnOn();
        }

        const maxRadius = Math.max(this.canvas.width, this.canvas.height);

        for (let i = 0; i < numWaves; i++) {
            setTimeout(() => {
                if (this.visible) {
                    this.drop(x, y, 1.0, maxRadius);
                }
            }, i * 200); // 200ms between waves
        }
    }

    /**
     * Create ripples that follow a path
     * @param {Array} points - Array of {x, y} coordinates
     * @param {number} speed - Time between points in ms (default: 100)
     */
    trail(points, speed = 100) {
        if (!this.visible) {
            this.turnOn();
        }

        points.forEach((point, index) => {
            setTimeout(() => {
                if (this.visible) {
                    this.drop(point.x, point.y, 0.8, 300);
                }
            }, index * speed);
        });
    }

    /**
     * Destroy the ripple effect and clean up
     */
    destroy() {
        this.destroyed = true;

        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
        }

        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DotLightRipple;
}
