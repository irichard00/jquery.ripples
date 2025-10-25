var gl;

function isPercentage(str) {
	return str[str.length - 1] == '%';
}

function loadConfig() {
	var canvas = document.createElement('canvas');
	gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

	if (!gl) {
		return null;
	}

	var extensions = {};
	[
		'OES_texture_float',
		'OES_texture_half_float',
		'OES_texture_float_linear',
		'OES_texture_half_float_linear'
	].forEach(function(name) {
		var extension = gl.getExtension(name);
		if (extension) {
			extensions[name] = extension;
		}
	});

	if (!extensions.OES_texture_float) {
		return null;
	}

	var configs = [];

	function createConfig(type, glType, arrayType) {
		var name = 'OES_texture_' + type,
			nameLinear = name + '_linear',
			linearSupport = nameLinear in extensions,
			configExtensions = [name];

		if (linearSupport) {
			configExtensions.push(nameLinear);
		}

		return {
			type: glType,
			arrayType: arrayType,
			linearSupport: linearSupport,
			extensions: configExtensions
		};
	}

	configs.push(
		createConfig('float', gl.FLOAT, Float32Array)
	);

	if (extensions.OES_texture_half_float) {
		configs.push(
			createConfig('half_float', extensions.OES_texture_half_float.HALF_FLOAT_OES, null)
		);
	}

	var texture = gl.createTexture();
	var framebuffer = gl.createFramebuffer();

	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	var config = null;

	for (var i = 0; i < configs.length; i++) {
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 32, 32, 0, gl.RGBA, configs[i].type, null);

		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
		if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
			config = configs[i];
			break;
		}
	}

	return config;
}

function createImageData(width, height) {
	try {
		return new ImageData(width, height);
	}
	catch (e) {
		var canvas = document.createElement('canvas');
		return canvas.getContext('2d').createImageData(width, height);
	}
}

function translateBackgroundPosition(value) {
	var parts = value.split(' ');

	if (parts.length === 1) {
		switch (value) {
			case 'center':
				return ['50%', '50%'];
			case 'top':
				return ['50%', '0'];
			case 'bottom':
				return ['50%', '100%'];
			case 'left':
				return ['0', '50%'];
			case 'right':
				return ['100%', '50%'];
			default:
				return [value, '50%'];
		}
	}
	else {
		return parts.map(function(part) {
			switch (value) {
				case 'center':
					return '50%';
				case 'top':
				case 'left':
					return '0';
				case 'right':
				case 'bottom':
					return '100%';
				default:
					return part;
			}
		});
	}
}

function createProgram(vertexSource, fragmentSource) {
	function compileSource(type, source) {
		var shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			throw new Error('compile error: ' + gl.getShaderInfoLog(shader));
		}
		return shader;
	}

	var program = {};

	program.id = gl.createProgram();
	gl.attachShader(program.id, compileSource(gl.VERTEX_SHADER, vertexSource));
	gl.attachShader(program.id, compileSource(gl.FRAGMENT_SHADER, fragmentSource));
	gl.linkProgram(program.id);
	if (!gl.getProgramParameter(program.id, gl.LINK_STATUS)) {
		throw new Error('link error: ' + gl.getProgramInfoLog(program.id));
	}

	program.uniforms = {};
	program.locations = {};
	gl.useProgram(program.id);
	gl.enableVertexAttribArray(0);
	var match, name, regex = /uniform (\w+) (\w+)/g, shaderCode = vertexSource + fragmentSource;
	while ((match = regex.exec(shaderCode)) != null) {
		name = match[2];
		program.locations[name] = gl.getUniformLocation(program.id, name);
	}

	return program;
}

function bindTexture(texture, unit) {
	gl.activeTexture(gl.TEXTURE0 + (unit || 0));
	gl.bindTexture(gl.TEXTURE_2D, texture);
}

function extractUrl(value) {
	var urlMatch = /url\(["']?([^"']*)["']?\)/.exec(value);
	if (urlMatch == null) {
		return null;
	}

	return urlMatch[1];
}

function isDataUri(url) {
	return url && url.match(/^data:/);
}

var config = loadConfig();
var transparentPixels = createImageData(32, 32);

var hostStylesInjected = false;
var HOST_CLASS = 'native-ripples-host';
var CANVAS_CLASS = 'native-ripples-canvas';

function ensureHostStyles() {
	if (hostStylesInjected) {
		return;
	}

	var style = document.createElement('style');
	style.textContent = [
		'.' + HOST_CLASS + ' { position: relative; z-index: 0; }',
		'.' + CANVAS_CLASS + ' { position: absolute; left: 0; top: 0; right: 0; bottom: 0; width: 100%; height: 100%; display: block; pointer-events: none; }'
	].join('\n');
	document.head.insertBefore(style, document.head.firstChild || null);
	hostStylesInjected = true;
}

function getOffset(el) {
	var rect = el.getBoundingClientRect();
	return {
		top: rect.top + window.pageYOffset,
		left: rect.left + window.pageXOffset
	};
}

function getBackgroundProperty(el, property) {
	return window.getComputedStyle(el).getPropertyValue(property) || '';
}

var defaultOptions = {
	imageUrl: null,
	resolution: 256,
	dropRadius: 18,
	perturbance: 0.12,
	iterationsPerStep: 2,
	crossOrigin: '',
	canvasPosition: 'auto',
	canvasZIndex: null,
	canvasOpacity: 0.2,
	hideCssBackground: true
};

class RippleEffect {
	constructor(el, options) {
		if (!config) {
			throw new Error('Your browser does not support the required WebGL extensions.');
		}

		if (!el) {
			throw new Error('RippleEffect requires a host element.');
		}

		ensureHostStyles();

		options = Object.assign({}, defaultOptions, options || {});

		this.element = el;
		this.element.classList.add(HOST_CLASS);

		this.resolution = options.resolution;
		this.textureDelta = new Float32Array([1 / this.resolution, 1 / this.resolution]);
		this.perturbance = options.perturbance;
		this.dropRadius = options.dropRadius;
		this.iterationsPerStep = Math.max(1, Math.min(4, Math.round(options.iterationsPerStep || 1)));
		this.undulateActive = false;
		this.undulateAmplitude = 0;
		this.undulatePhase = 0;
		this.undulateFrequency = 18;
		this.undulateSpeed = 0.12;
		this.undulateDecay = 0.92;
		this.crossOrigin = options.crossOrigin;
		this.imageUrl = options.imageUrl;
		this.shouldHideCssBackground = options.hideCssBackground !== false;

		this.canvasPosition = options.canvasPosition === 'auto'
			? ((this.element === document.body || this.element === document.documentElement) ? 'fixed' : 'absolute')
			: options.canvasPosition;

		this.canvas = document.createElement('canvas');
		this.canvas.className = CANVAS_CLASS;
		this.canvas.style.opacity = String(options.canvasOpacity);

		if (this.canvasPosition === 'fixed') {
			this.canvas.style.position = 'fixed';
			this.canvas.style.left = '0';
			this.canvas.style.top = '0';
			this.canvas.style.width = '100vw';
			this.canvas.style.height = '100vh';
		}

		if (options.canvasZIndex !== null && options.canvasZIndex !== undefined) {
			this.canvas.style.zIndex = String(options.canvasZIndex);
		}
		else {
			this.canvas.style.zIndex = this.canvasPosition === 'fixed' ? '9990' : '0';
		}

		var initialSize = this.getRenderSize();
		this.canvas.width = initialSize.width;
		this.canvas.height = initialSize.height;

		this.element.appendChild(this.canvas);
		this.context = gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');

		config.extensions.forEach(function(name) {
			gl.getExtension(name);
		});

		this.updateSize = this.updateSize.bind(this);
		window.addEventListener('resize', this.updateSize);

		this.textures = [];
		this.framebuffers = [];
		this.bufferWriteIndex = 0;
		this.bufferReadIndex = 1;

		var arrayType = config.arrayType;
		var textureData = arrayType ? new arrayType(this.resolution * this.resolution * 4) : null;

		for (var i = 0; i < 2; i++) {
			var texture = gl.createTexture();
			var framebuffer = gl.createFramebuffer();

			gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, config.linearSupport ? gl.LINEAR : gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, config.linearSupport ? gl.LINEAR : gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.resolution, this.resolution, 0, gl.RGBA, config.type, textureData);

			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

			this.textures.push(texture);
			this.framebuffers.push(framebuffer);
		}

		this.quad = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			-1, -1,
			+1, -1,
			+1, +1,
			-1, +1
		]), gl.STATIC_DRAW);

		this.initShaders();
		this.initTexture();
		this.setTransparentTexture();
		this.loadImage();

		gl.clearColor(0, 0, 0, 0);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		this.visible = true;
		this.running = true;
		this.inited = true;
		this.destroyed = false;

		this.undulateEvents = [];
		this.undulateStartTime = 0;
		this.undulateDuration = 5000;
		this.undulateNextEventIndex = 0;
		this.undulateBaseAmplitude = 0;
		this.undulateBaseStrength = 0;

		var that = this;
		function step() {
			if (!that.destroyed) {
				that.step();
				requestAnimationFrame(step);
			}
		}

		requestAnimationFrame(step);
	}

	loadImage() {
		var that = this;

		gl = this.context;

		var newImageSource = this.imageUrl ||
			extractUrl(this.originalCssBackgroundImage) ||
			extractUrl(getBackgroundProperty(this.element, 'background-image'));

		if (newImageSource == this.imageSource) {
			return;
		}

		this.imageSource = newImageSource;

		if (!this.imageSource) {
			this.setTransparentTexture();
			return;
		}

		var image = new Image;
		image.onload = function() {
			gl = that.context;

			function isPowerOfTwo(x) {
				return (x & (x - 1)) == 0;
			}

			var wrapping = (isPowerOfTwo(image.width) && isPowerOfTwo(image.height)) ? gl.REPEAT : gl.CLAMP_TO_EDGE;

			gl.bindTexture(gl.TEXTURE_2D, that.backgroundTexture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapping);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapping);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

			that.backgroundWidth = image.width;
			that.backgroundHeight = image.height;

			that.hideCssBackground();
		};

		image.onerror = function() {
			gl = that.context;
			that.setTransparentTexture();
		};

		image.crossOrigin = isDataUri(this.imageSource) ? null : this.crossOrigin;

		image.src = this.imageSource;
	}

	step() {
		gl = this.context;

		if (!this.visible) {
			return;
		}

		var now = performance.now();

		this.computeTextureBoundaries();

		if (this.undulateActive) {
			this.applyUndulateSequence(now);
		}
		else if (this.undulateAmplitude > 0) {
			this.undulateAmplitude *= this.undulateDecay;
			if (this.undulateAmplitude < 0.0005) {
				this.undulateAmplitude = 0;
			}
		}

		if (this.running) {
			var iterations = this.iterationsPerStep || 1;
			for (var i = 0; i < iterations; i++) {
				this.update();
			}

			gl.viewport(0, 0, this.canvas.width, this.canvas.height);

			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

			gl.useProgram(this.renderProgram.id);

			this.renderProgram.uniforms.perturbance = this.perturbance;
			gl.uniform1f(this.renderProgram.locations.perturbance, this.perturbance);

			if (this.undulateActive || this.undulateAmplitude > 0) {
				this.undulatePhase += this.undulateSpeed;
			}

			gl.uniform1f(this.renderProgram.locations.undulatePhase, this.undulatePhase);
			gl.uniform1f(this.renderProgram.locations.undulateAmplitude, this.undulateAmplitude);
			gl.uniform1f(this.renderProgram.locations.undulateFrequency, this.undulateFrequency);

			gl.uniform2fv(this.renderProgram.locations.topLeft, this.renderProgram.uniforms.topLeft);
			gl.uniform2fv(this.renderProgram.locations.bottomRight, this.renderProgram.uniforms.bottomRight);
			gl.uniform2fv(this.renderProgram.locations.containerRatio, this.renderProgram.uniforms.containerRatio);

			gl.uniform2fv(this.renderProgram.locations.delta, this.textureDelta);

			bindTexture(this.backgroundTexture, 0);
			bindTexture(this.textures[this.bufferReadIndex], 1);

			gl.uniform1i(this.renderProgram.locations.samplerBackground, 0);
			gl.uniform1i(this.renderProgram.locations.samplerRipples, 1);

			this.drawQuad();
		}
	}

	drawQuad() {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
	}

	update() {
		gl.viewport(0, 0, this.resolution, this.resolution);

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[this.bufferWriteIndex]);
		bindTexture(this.textures[this.bufferReadIndex]);
		gl.useProgram(this.updateProgram.id);

		this.drawQuad();

		this.swapBufferIndices();
	}

	swapBufferIndices() {
		this.bufferWriteIndex = 1 - this.bufferWriteIndex;
		this.bufferReadIndex = 1 - this.bufferReadIndex;
	}

	computeTextureBoundaries() {
		var backgroundSize = getBackgroundProperty(this.element, 'background-size');
		var backgroundAttachment = getBackgroundProperty(this.element, 'background-attachment');
		var backgroundPosition = translateBackgroundPosition(getBackgroundProperty(this.element, 'background-position'));

		var container;
		if (backgroundAttachment.trim() === 'fixed') {
			container = { left: window.pageXOffset, top: window.pageYOffset };
			container.width = window.innerWidth;
			container.height = window.innerHeight;
		}
		else {
			container = getOffset(this.element);
			container.width = this.getInnerWidth();
			container.height = this.getInnerHeight();
		}

		var backgroundWidth;
		var backgroundHeight;

		if (backgroundSize === 'cover') {
			var coverScale = Math.max(container.width / this.backgroundWidth, container.height / this.backgroundHeight);
			backgroundWidth = this.backgroundWidth * coverScale;
			backgroundHeight = this.backgroundHeight * coverScale;
		}
		else if (backgroundSize === 'contain') {
			var containScale = Math.min(container.width / this.backgroundWidth, container.height / this.backgroundHeight);
			backgroundWidth = this.backgroundWidth * containScale;
			backgroundHeight = this.backgroundHeight * containScale;
		}
		else {
			var backgroundParts = backgroundSize.split(' ');
			backgroundWidth = backgroundParts[0] || '';
			backgroundHeight = backgroundParts[1] || backgroundWidth;

			if (isPercentage(backgroundWidth)) {
				backgroundWidth = container.width * parseFloat(backgroundWidth) / 100;
			}
			else if (backgroundWidth !== 'auto') {
				backgroundWidth = parseFloat(backgroundWidth);
			}

			if (isPercentage(backgroundHeight)) {
				backgroundHeight = container.height * parseFloat(backgroundHeight) / 100;
			}
			else if (backgroundHeight !== 'auto') {
				backgroundHeight = parseFloat(backgroundHeight);
			}

			if (backgroundWidth === 'auto') {
				if (backgroundHeight === 'auto') {
					backgroundWidth = this.backgroundWidth;
					backgroundHeight = this.backgroundHeight;
				}
				else {
					backgroundWidth = backgroundHeight * this.backgroundWidth / this.backgroundHeight;
				}
			}
			else if (backgroundHeight === 'auto') {
				backgroundHeight = backgroundWidth * this.backgroundHeight / this.backgroundWidth;
			}
		}

		if (!backgroundWidth || !backgroundHeight) {
			backgroundWidth = this.backgroundWidth;
			backgroundHeight = this.backgroundHeight;
		}

		var backgroundX = backgroundPosition[0];
		var backgroundY = backgroundPosition[1];

		if (isPercentage(backgroundX)) {
			backgroundX = container.left + (container.width - backgroundWidth) * parseFloat(backgroundX) / 100;
		}
		else {
			backgroundX = container.left + parseFloat(backgroundX);
		}

		if (isPercentage(backgroundY)) {
			backgroundY = container.top + (container.height - backgroundHeight) * parseFloat(backgroundY) / 100;
		}
		else {
			backgroundY = container.top + parseFloat(backgroundY);
		}

		var elementOffset = getOffset(this.element);
		var innerWidth = this.getInnerWidth();
		var innerHeight = this.getInnerHeight();

		this.renderProgram.uniforms.topLeft = new Float32Array([
			(elementOffset.left - backgroundX) / backgroundWidth,
			(elementOffset.top - backgroundY) / backgroundHeight
		]);
		this.renderProgram.uniforms.bottomRight = new Float32Array([
			this.renderProgram.uniforms.topLeft[0] + innerWidth / backgroundWidth,
			this.renderProgram.uniforms.topLeft[1] + innerHeight / backgroundHeight
		]);

		var maxSide = Math.max(this.canvas.width, this.canvas.height);

		this.renderProgram.uniforms.containerRatio = new Float32Array([
			this.canvas.width / maxSide,
			this.canvas.height / maxSide
		]);
	}

	initShaders() {
		var vertexShader = [
			'attribute vec2 vertex;',
			'varying vec2 coord;',
			'void main() {',
				'coord = vertex * 0.5 + 0.5;',
				'gl_Position = vec4(vertex, 0.0, 1.0);',
			'}'
		].join('\n');

		this.dropProgram = createProgram(vertexShader, [
			'precision highp float;',
			'const float PI = 3.141592653589793;',
			'uniform sampler2D texture;',
			'uniform vec2 center;',
			'uniform float radius;',
			'uniform float strength;',
			'varying vec2 coord;',
			'void main() {',
				'vec4 info = texture2D(texture, coord);',
				'float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - coord) / radius);',
				'drop = 0.5 - cos(drop * PI) * 0.5;',
				'info.r += drop * strength;',
				'gl_FragColor = info;',
			'}'
		].join('\n'));

		this.updateProgram = createProgram(vertexShader, [
			'precision highp float;',
			'uniform sampler2D texture;',
			'uniform vec2 delta;',
			'varying vec2 coord;',
			'void main() {',
				'vec4 info = texture2D(texture, coord);',
				'vec2 dx = vec2(delta.x, 0.0);',
				'vec2 dy = vec2(0.0, delta.y);',
				'float average = (',
					'texture2D(texture, coord - dx).r +',
					'texture2D(texture, coord - dy).r +',
					'texture2D(texture, coord + dx).r +',
					'texture2D(texture, coord + dy).r',
				') * 0.25;',
				'// Increase propagation speed by amplifying the displacement delta',
				'info.g += (average - info.r) * 2.0;',
				'info.g *= 0.997;',
				'info.r += info.g;',
				'// Aggressively absorb energy near edges so waves dissipate outwards',
				'float borderDistance = min(min(coord.x, 1.0 - coord.x), min(coord.y, 1.0 - coord.y));',
				'float edgeAttenuation = smoothstep(0.0, 0.12, borderDistance);',
				'info.r *= edgeAttenuation * edgeAttenuation;',
				'info.g *= edgeAttenuation * edgeAttenuation;',
				'gl_FragColor = info;',
			'}'
		].join('\n'));
		gl.uniform2fv(this.updateProgram.locations.delta, this.textureDelta);

		this.renderProgram = createProgram([
			'precision highp float;',
			'attribute vec2 vertex;',
			'uniform vec2 topLeft;',
			'uniform vec2 bottomRight;',
			'uniform vec2 containerRatio;',
			'varying vec2 ripplesCoord;',
			'varying vec2 backgroundCoord;',
			'void main() {',
				'backgroundCoord = mix(topLeft, bottomRight, vertex * 0.5 + 0.5);',
				'backgroundCoord.y = 1.0 - backgroundCoord.y;',
				'ripplesCoord = vec2(vertex.x, -vertex.y) * containerRatio * 0.5 + 0.5;',
				'gl_Position = vec4(vertex.x, -vertex.y, 0.0, 1.0);',
			'}'
		].join('\n'), [
			'precision highp float;',
			'uniform sampler2D samplerBackground;',
			'uniform sampler2D samplerRipples;',
			'uniform vec2 delta;',
			'uniform float perturbance;',
			'uniform float undulatePhase;',
			'uniform float undulateAmplitude;',
			'uniform float undulateFrequency;',
			'varying vec2 ripplesCoord;',
			'varying vec2 backgroundCoord;',
			'void main() {',
				'float height = texture2D(samplerRipples, ripplesCoord).r;',
				'float heightX = texture2D(samplerRipples, vec2(ripplesCoord.x + delta.x, ripplesCoord.y)).r;',
				'float heightY = texture2D(samplerRipples, vec2(ripplesCoord.x, ripplesCoord.y + delta.y)).r;',
				'vec3 dx = vec3(delta.x, heightX - height, 0.0);',
				'vec3 dy = vec3(0.0, heightY - height, delta.y);',
				'vec2 gradient = vec2(height - heightX, height - heightY);',
				'float slopeStrength = clamp(length(gradient) * 50.0, 0.0, 2.0);',
				'vec2 offsetDir = -normalize(cross(dy, dx)).xz;',
				'vec2 parallax = offsetDir * (perturbance * (1.0 + slopeStrength * 1.6));',
				'vec2 undulateOffset = vec2(',
					'sin((backgroundCoord.y + undulatePhase) * undulateFrequency),',
					'cos((backgroundCoord.x + undulatePhase) * undulateFrequency)',
				') * undulateAmplitude;',
				'vec4 baseSample = texture2D(samplerBackground, backgroundCoord + parallax + undulateOffset);',
				'vec4 detailSample = texture2D(samplerBackground, backgroundCoord + parallax * 1.3 + undulateOffset * 0.6);',
				'vec3 baseColor = mix(baseSample.rgb, detailSample.rgb, 0.35);',
				'float crest = smoothstep(0.015, 0.18, height);',
				'float trough = smoothstep(0.015, 0.18, -height);',
				'vec3 highlightTint = vec3(0.32, 0.52, 0.86);',
				'vec3 shadowTint = vec3(0.24, 0.15, 0.06);',
				'vec3 foamTint = vec3(0.86, 0.93, 1.0);',
				'vec3 color = baseColor;',
				'float directional = max(0.0, dot(offsetDir, normalize(vec2(-0.55, 0.83))));',
				'float specular = pow(directional, 6.0) * (0.25 + slopeStrength * 0.45);',
				'vec3 normal = normalize(vec3(-gradient.x * 45.0, 1.0, -gradient.y * 45.0));',
				'float fresnel = pow(1.0 - clamp(normal.y, 0.0, 1.0), 3.0);',
				'float waveStrength = smoothstep(0.01, 0.22, abs(height));',
				'float foam = clamp(crest * slopeStrength * 0.35, 0.0, 0.35);',
				'color += highlightTint * waveStrength * 1.05;',
				'color -= shadowTint * trough * 0.75;',
				'color = mix(color, foamTint, foam);',
				'color += highlightTint * fresnel * 0.3;',
				'color += vec3(specular);',
				'gl_FragColor = vec4(clamp(color, 0.0, 1.0), baseSample.a);',
			'}'
		].join('\n'));
		gl.uniform2fv(this.renderProgram.locations.delta, this.textureDelta);
		gl.uniform1f(this.renderProgram.locations.undulatePhase, this.undulatePhase);
		gl.uniform1f(this.renderProgram.locations.undulateAmplitude, this.undulateAmplitude);
		gl.uniform1f(this.renderProgram.locations.undulateFrequency, this.undulateFrequency);
	}

	initTexture() {
		this.backgroundTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	}

	setTransparentTexture() {
		gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, transparentPixels);
	}

	hideCssBackground() {
		if (!this.shouldHideCssBackground) {
			return;
		}

		var inlineCss = this.element.style.backgroundImage;

		if (inlineCss === 'none') {
			return;
		}

		this.originalInlineCss = inlineCss;
		this.originalCssBackgroundImage = getBackgroundProperty(this.element, 'background-image');
		this.element.style.backgroundImage = 'none';
	}

	restoreCssBackground() {
		if (!this.shouldHideCssBackground) {
			return;
		}

		this.element.style.backgroundImage = this.originalInlineCss || '';
	}

	drop(x, y, radius, strength) {
		gl = this.context;

		var elWidth = this.getInnerWidth();
		var elHeight = this.getInnerHeight();
		var longestSide = Math.max(elWidth, elHeight);

		radius = radius / longestSide;

		var dropPosition = new Float32Array([
			(2 * x - elWidth) / longestSide,
			(elHeight - 2 * y) / longestSide
		]);

		gl.viewport(0, 0, this.resolution, this.resolution);

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[this.bufferWriteIndex]);
		bindTexture(this.textures[this.bufferReadIndex]);

		gl.useProgram(this.dropProgram.id);
		gl.uniform2fv(this.dropProgram.locations.center, dropPosition);
		gl.uniform1f(this.dropProgram.locations.radius, radius);
		gl.uniform1f(this.dropProgram.locations.strength, strength);

		this.drawQuad();

		this.swapBufferIndices();
	}

	undulate(amplitude) {
		var intensity = typeof amplitude == 'number' ? Math.max(0.2, Math.min(1.5, Math.abs(amplitude))) : 1;
		var now = performance.now();

		var width = this.getInnerWidth();
		var height = this.getInnerHeight();

		if (width <= 0 || height <= 0) {
			return;
		}

		var baseStrength = 0.4 * intensity;
		var baseAmplitude = Math.max(0.02, Math.min(0.05, intensity * 0.04));
		var baseRadius = this.dropRadius * (0.4 + intensity * 0.3);

		this.undulateStartTime = now;
		this.undulateBaseStrength = baseStrength;
		this.undulateBaseAmplitude = baseAmplitude;
		this.undulateAmplitude = baseAmplitude;
		this.undulatePhase = 0;
		this.undulateEvents = this.createUndulateEvents(now, width, height, this.undulateDuration, baseStrength, baseRadius);
		this.undulateNextEventIndex = 0;
		this.undulateActive = true;
	}

	applyUndulateSequence(now) {
		while (this.undulateNextEventIndex < this.undulateEvents.length && this.undulateEvents[this.undulateNextEventIndex].time <= now) {
			var event = this.undulateEvents[this.undulateNextEventIndex++];
			this.drop(event.x, event.y, event.radius, event.strength);
		}

		var duration = this.undulateDuration;
		var startTime = this.undulateStartTime;

		if (duration <= 0) {
			this.undulateActive = false;
			this.undulateAmplitude = 0;
			this.undulateEvents = [];
			this.undulateNextEventIndex = 0;
			return;
		}

		var elapsed = now - startTime;
		var progress = Math.max(0, Math.min(1, elapsed / duration));
		var fade = 1 - progress;

		this.undulateAmplitude = this.undulateBaseAmplitude * fade * fade;

		if (progress >= 1 && this.undulateNextEventIndex >= this.undulateEvents.length) {
			this.undulateActive = false;
			if (this.undulateAmplitude < 0.0005) {
				this.undulateAmplitude = 0;
			}
			this.undulateEvents = [];
			this.undulateNextEventIndex = 0;
		}
	}

	createUndulateEvents(startTime, width, height, duration, baseStrength, baseRadius) {
		var events = [];

		if (duration <= 0) {
			return events;
		}

		var gridSize = 18;
		var cellWidth = width / gridSize;
		var cellHeight = height / gridSize;

		for (var row = 0; row < gridSize; row++) {
			for (var col = 0; col < gridSize; col++) {
				var scheduledTime = startTime + Math.random() * duration * 0.9;
				var jitterX = (Math.random() - 0.5) * cellWidth * 0.6;
				var jitterY = (Math.random() - 0.5) * cellHeight * 0.6;
				var x = (col + 0.5) * cellWidth + jitterX;
				var y = (row + 0.5) * cellHeight + jitterY;
				x = Math.max(0, Math.min(width, x));
				y = Math.max(0, Math.min(height, y));

				var relativeTime = (scheduledTime - startTime) / duration;
				var strength = baseStrength * (0.6 + Math.random() * 0.4) * (1 - relativeTime * 0.65);
				var radius = baseRadius * (0.7 + Math.random() * 0.5);

				events.push({
					time: scheduledTime,
					x: x,
					y: y,
					strength: strength,
					radius: radius
				});
			}
		}

		var centerX = width / 2;
		var centerY = height / 2;
		var ringCount = 9;
		var maxRadius = Math.sqrt(width * width + height * height) * 0.55;

		for (var ring = 0; ring < ringCount; ring++) {
			var ringProgress = ring / ringCount;
			var ringTime = startTime + ringProgress * duration;
			var ringRadius = maxRadius * ringProgress * 0.9;
			var spokes = 10 + Math.floor(ringProgress * 28);

			for (var spoke = 0; spoke < spokes; spoke++) {
				var angle = (Math.PI * 2 * spoke) / spokes + ringProgress * 1.1;
				var xPulse = centerX + Math.cos(angle) * ringRadius;
				var yPulse = centerY + Math.sin(angle) * ringRadius;
				xPulse = Math.max(0, Math.min(width, xPulse));
				yPulse = Math.max(0, Math.min(height, yPulse));

				events.push({
					time: ringTime + Math.random() * duration * 0.06,
					x: xPulse,
					y: yPulse,
					strength: baseStrength * (0.9 - ringProgress * 0.75),
					radius: baseRadius * (1.1 + ringProgress * 0.65)
				});
			}
		}

		events.sort(function(a, b) {
			return a.time - b.time;
		});

		return events;
	}

	updateSize() {
		var size = this.getRenderSize();

		if (size.width != this.canvas.width || size.height != this.canvas.height) {
			this.canvas.width = size.width;
			this.canvas.height = size.height;
		}
	}

	getRenderSize() {
		if (this.canvasPosition === 'fixed') {
			return {
				width: Math.max(window.innerWidth, document.documentElement.clientWidth),
				height: Math.max(window.innerHeight, document.documentElement.clientHeight)
			};
		}

		return {
			width: this.getInnerWidth(),
			height: this.getInnerHeight()
		};
	}

	getInnerWidth() {
		if (this.element === document.body || this.element === document.documentElement) {
			return Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
		}

		return this.element.clientWidth;
	}

	getInnerHeight() {
		if (this.element === document.body || this.element === document.documentElement) {
			return Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
		}

		return this.element.clientHeight;
	}

	destroy() {
		gl = null;

		window.removeEventListener('resize', this.updateSize);

		if (this.canvas.parentNode) {
			this.canvas.parentNode.removeChild(this.canvas);
		}
		this.restoreCssBackground();

		this.destroyed = true;
	}

	show() {
		this.visible = true;
		this.canvas.style.display = 'block';
		this.hideCssBackground();
	}

	hide() {
		this.visible = false;
		this.canvas.style.display = 'none';
		this.restoreCssBackground();
	}

	pause() {
		this.running = false;
	}

	play() {
		this.running = true;
	}

	set(property, value) {
		switch (property) {
			case 'dropRadius':
			case 'perturbance':
			case 'crossOrigin':
				this[property] = value;
				break;
			case 'iterationsPerStep':
				this.iterationsPerStep = Math.max(1, Math.min(4, Math.round(value)));
				break;
			case 'imageUrl':
				this.imageUrl = value;
				this.loadImage();
				break;
		}
	}
}

function initPageRippleDemo(config) {
	if (typeof window === 'undefined') {
		return null;
	}

	var target = config && config.target || document.body;

	var ripple;

	try {
		ripple = new RippleEffect(target, {
			canvasPosition: 'fixed',
			canvasZIndex: (config && config.zIndex != null) ? config.zIndex : 9990,
			hideCssBackground: (config && config.hideCssBackground !== undefined) ? config.hideCssBackground : false
		});
	}
	catch (error) {
		console.error(error);
		return null;
	}

	var toggle = document.querySelector(config && config.toggleSelector || '[data-ripple-toggle]');
	var undulateButton = document.querySelector(config && config.undulateSelector || '[data-ripple-undulate]');
	var form = document.querySelector(config && config.formSelector || '[data-ripple-form]');
	var inputX = document.querySelector(config && config.inputXSelector || '[data-ripple-input="x"]');
	var inputY = document.querySelector(config && config.inputYSelector || '[data-ripple-input="y"]');

	function setActive(active) {
		if (active) {
			ripple.show();
			ripple.play();
			if (toggle) {
				toggle.textContent = 'Turn Off';
			}
		}
		else {
			ripple.hide();
			ripple.pause();
			if (toggle) {
				toggle.textContent = 'Turn On';
			}
		}
	}

	if (toggle) {
		toggle.addEventListener('click', function() {
			setActive(ripple.canvas.style.display === 'none');
		});
		setActive(true);
	}

	if (form && inputX && inputY) {
		form.addEventListener('submit', function(event) {
			event.preventDefault();
			var x = parseFloat(inputX.value);
			var y = parseFloat(inputY.value);

			if (!isNaN(x) && !isNaN(y)) {
				ripple.drop(
					Math.max(0, Math.min(ripple.getInnerWidth(), x)),
					Math.max(0, Math.min(ripple.getInnerHeight(), y)),
					ripple.dropRadius * 0.6,
					0.45
				);
			}
		});
	}

	if (undulateButton) {
		undulateButton.addEventListener('click', function() {
			ripple.undulate();
		});
	}

	return ripple;
}

export { RippleEffect, initPageRippleDemo };
export default RippleEffect;

if (typeof window !== 'undefined') {
	window.RippleEffect = RippleEffect;
	window.initPageRippleDemo = initPageRippleDemo;

	window.addEventListener('DOMContentLoaded', function() {
		var toggle = document.querySelector('[data-ripple-toggle]');
		var form = document.querySelector('[data-ripple-form]');

		if (toggle && form) {
			initPageRippleDemo();
		}
	});
}
