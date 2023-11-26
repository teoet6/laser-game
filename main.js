// NAPRAVI
// model za preqexti si lazeri
// izsledvane na naqin lazerite da si smenyat qetnostta
// vwzmojnost za triene prez lazer

const $ = (query) => document.querySelector(query);

const currentVersion = 'swtvorenie-1';
const defaultSavedGame = '{"version":"swtvorenie-1","cameraYaw":3.556282883863645,"cameraPitch":0.4306076330520385,"cameraX":3.3892874369104993,"cameraY":3.800000000000001,"cameraZ":7.1149267376119285,"blocks":[[0,0,0,{"type":"mirror","orientation":0,"flipped":false}],[0,1,0,{"type":"mirror","orientation":1,"flipped":true}],[1,0,0,{"type":"mirror","orientation":3,"flipped":false}],[1,1,0,{"type":"mirror","orientation":3,"flipped":true}]],"lasers":[[1,1,0,1],[1,0,0,16],[0,0,0,8],[0,1,0,2]]}';

const degrees = Math.PI / 180;

const canvas = $('#canvas');
const gl = canvas.getContext('webgl');
const glInstanced = gl.getExtension('ANGLE_instanced_arrays');

let fov = 90 * degrees;
const cameraSpeed = 10;

let cameraYaw;
let cameraPitch;
let cameraZ;
let cameraY;
let cameraX;

let blocks;
let lasers;

let aspectRatio = 1;

let destroyPos = null;
let createPos = null;

let mirrorRenderable = null;

let tickTime = 0;
let updateTime = 0;
let drawTime = 0;

const isKeyPressed = {};
const isMousePressed = {};

const laserRadius = 0.05;

const Direction = {
	xNeg: 0,
	yNeg: 1,
	zNeg: 2,
	xPos: 3,
	yPos: 4,
	zPos: 5,
}

const createRenderable = (renderable) => {
	if (renderable.vertexSrc != undefined) {
		renderable.vertexShader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(renderable.vertexShader, renderable.vertexSrc);
		gl.compileShader(renderable.vertexShader);
		if (!gl.getShaderParameter(renderable.vertexShader, gl.COMPILE_STATUS)) return console.error(gl.getShaderInfoLog(renderable.vertexShader));
	}

	if (renderable.fragmentSrc != undefined) {
		renderable.fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(renderable.fragmentShader, renderable.fragmentSrc);
		gl.compileShader(renderable.fragmentShader);
		if (!gl.getShaderParameter(renderable.fragmentShader, gl.COMPILE_STATUS)) return console.error(gl.getShaderInfoLog(renderable.fragmentShader));
	}

	if (renderable.vertexShader != undefined && renderable.fragmentShader != undefined) {
		renderable.program = gl.createProgram();
		gl.attachShader(renderable.program, renderable.vertexShader);
		gl.attachShader(renderable.program, renderable.fragmentShader);
		gl.linkProgram(renderable.program);

		if (!gl.getProgramParameter(renderable.program, gl.LINK_STATUS)) return console.error(gl.getProgramInfoLog(renderable.program));
	}

	if (renderable.arrays != undefined) {
		renderable.arrayBuffers = {};

		for (const [name, array] of Object.entries(renderable.arrays)) {
			renderable.arrayBuffers[name] = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, renderable.arrayBuffers[name]);
			gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
		}
	}

	if (renderable.elements != undefined) {
		renderable.elementBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, renderable.elementBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, renderable.elements, gl.STATIC_DRAW);
	}

	if (renderable.images != undefined) {
		renderable.textures = [];

		for (const it of renderable.images) {
			const texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, it);

			renderable.textures.push(texture);
		}
	}

	if (renderable.program != undefined) {
		renderable.attribs = {};
		const attribCount = gl.getProgramParameter(renderable.program, gl.ACTIVE_ATTRIBUTES);
		for (let index = 0; index < attribCount; index += 1) {
			const attrib = gl.getActiveAttrib(renderable.program, index);
			const location = gl.getAttribLocation(renderable.program, attrib.name);
			renderable.attribs[attrib.name] = {
				name: attrib.name,
				size: attrib.size,
				type: attrib.type,
				location: location,
				index: index,
			};
		}

		renderable.uniforms = {};
		const uniformCount = gl.getProgramParameter(renderable.program, gl.ACTIVE_UNIFORMS);
		for (let index = 0; index < uniformCount; index += 1) {
			const uniform = gl.getActiveUniform(renderable.program, index);
			const location = gl.getUniformLocation(renderable.program, uniform.name);
			renderable.uniforms[uniform.name] = {
				name: uniform.name,
				size: uniform.size,
				type: uniform.type,
				location: location,
				index: index,
			};
		}
	}

	if (!renderable.mode) return console.error('Rendering mode not specified')
	if (!renderable.count) return console.error('Rendering count not specified')

	return renderable;
}

const renderBatch = (renderable, attribsAos=[]) => {
	if (attribsAos.length == 0) return;

	const instanceAttribPointer = (location, dimension, type, norm, stride, offset) => {
		gl.enableVertexAttribArray(location);
		gl.vertexAttribPointer(location, dimension, type, norm, stride, offset);
		glInstanced.vertexAttribDivisorANGLE(location, 1);
	}

	gl.useProgram(renderable.program);

	if (renderable.arrayBuffers != undefined && renderable.program != undefined) {
		for (const [name, buffer] of Object.entries(renderable.arrayBuffers)) {
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

			const attrib = renderable.attribs['a_' + name];
			gl.enableVertexAttribArray(attrib.location);

			switch (attrib.type) {
				case gl.FLOAT      : gl.vertexAttribPointer(attrib.location, 1, gl.FLOAT, false, 0, 0); break;
				case gl.FLOAT_VEC2 : gl.vertexAttribPointer(attrib.location, 2, gl.FLOAT, false, 0, 0); break;
				case gl.FLOAT_VEC3 : gl.vertexAttribPointer(attrib.location, 3, gl.FLOAT, false, 0, 0); break;
				case gl.FLOAT_VEC4 : gl.vertexAttribPointer(attrib.location, 4, gl.FLOAT, false, 0, 0); break;
				case gl.INT        : gl.vertexAttribPointer(attrib.location, 1, gl.INT,   false, 0, 0); break;
				case gl.INT_VEC2   : gl.vertexAttribPointer(attrib.location, 2, gl.INT,   false, 0, 0); break;
				case gl.INT_VEC3   : gl.vertexAttribPointer(attrib.location, 3, gl.INT,   false, 0, 0); break;
				case gl.INT_VEC4   : gl.vertexAttribPointer(attrib.location, 4, gl.INT,   false, 0, 0); break;
				case gl.BOOL       : gl.vertexAttribPointer(attrib.location, 1, gl.BOOL,  false, 0, 0); break;
				case gl.BOOL_VEC2  : gl.vertexAttribPointer(attrib.location, 2, gl.BOOL,  false, 0, 0); break;
				case gl.BOOL_VEC3  : gl.vertexAttribPointer(attrib.location, 3, gl.BOOL,  false, 0, 0); break;
				case gl.BOOL_VEC4  : gl.vertexAttribPointer(attrib.location, 4, gl.BOOL,  false, 0, 0); break;
				default: return console.error('Unrecognized attribute type:', attrib.type);
			}

			glInstanced.vertexAttribDivisorANGLE(attrib.location, 0); // NAPRAVI tova i risuvaneto po instancii v edin kod
		}
	}

	if (renderable.textures != undefined) {
		for (let idx = 0; idx < renderable.textures.length; idx += 1) {
			gl.activeTexture(gl.TEXTURE0 + idx);
			gl.bindTexture(gl.TEXTURE_2D, renderable.textures[idx]);
		}
	}

	const attribsSoa = {};
	const attribsElementsPerInstance = {};
	const attribsBuffer = {};

	for (const [key, value] of Object.entries(attribsAos[0])) {
		attribsElementsPerInstance[key] = value.length;
		const AttribTypedArray = Object.getPrototypeOf(value).constructor;
		attribsSoa[key] = new AttribTypedArray(attribsAos.length * attribsElementsPerInstance[key]);
	}

	for (let instanceIdx = 0; instanceIdx < attribsAos.length; instanceIdx += 1) {
		for (const [key, value] of Object.entries(attribsAos[instanceIdx])) {
			for (let idx = 0; idx < value.length; idx += 1) {
				attribsSoa[key][instanceIdx * attribsElementsPerInstance[key] + idx] = value[idx];
			}
		}
	}

	for (const name of Object.keys(attribsSoa)) {
		attribsBuffer[name] = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, attribsBuffer[name]);
		gl.bufferData(gl.ARRAY_BUFFER, attribsSoa[name], gl.STREAM_DRAW);

		const attrib = renderable.attribs['a_' + name];

		// if (attrib.location == 1) debugger;

		const vertexAttribPointerMatrix = (type, dimension) => {
			for (let i = 0; i < dimension; i += 1) {
				instanceAttribPointer(
					attrib.location + i,
					dimension,
					type,
					false,
					attribsSoa[name].BYTES_PER_ELEMENT * dimension * dimension,
					attribsSoa[name].BYTES_PER_ELEMENT * dimension * i,
				);
			}
		}

		switch (attrib.type) {
			case gl.FLOAT      : instanceAttribPointer(attrib.location, 1, gl.FLOAT, false, 0, 0); break;
			case gl.FLOAT_VEC2 : instanceAttribPointer(attrib.location, 2, gl.FLOAT, false, 0, 0); break;
			case gl.FLOAT_VEC3 : instanceAttribPointer(attrib.location, 3, gl.FLOAT, false, 0, 0); break;
			case gl.FLOAT_VEC4 : instanceAttribPointer(attrib.location, 4, gl.FLOAT, false, 0, 0); break;
			case gl.INT        : instanceAttribPointer(attrib.location, 1, gl.INT,   false, 0, 0); break;
			case gl.INT_VEC2   : instanceAttribPointer(attrib.location, 2, gl.INT,   false, 0, 0); break;
			case gl.INT_VEC3   : instanceAttribPointer(attrib.location, 3, gl.INT,   false, 0, 0); break;
			case gl.INT_VEC4   : instanceAttribPointer(attrib.location, 4, gl.INT,   false, 0, 0); break;
			case gl.BOOL       : instanceAttribPointer(attrib.location, 1, gl.BOOL,  false, 0, 0); break;
			case gl.BOOL_VEC2  : instanceAttribPointer(attrib.location, 2, gl.BOOL,  false, 0, 0); break;
			case gl.BOOL_VEC3  : instanceAttribPointer(attrib.location, 3, gl.BOOL,  false, 0, 0); break;
			case gl.BOOL_VEC4  : instanceAttribPointer(attrib.location, 4, gl.BOOL,  false, 0, 0); break;
			case gl.FLOAT_MAT2 : vertexAttribPointerMatrix(gl.FLOAT, 2); break;
			case gl.FLOAT_MAT3 : vertexAttribPointerMatrix(gl.FLOAT, 3); break;
			case gl.FLOAT_MAT4 : vertexAttribPointerMatrix(gl.FLOAT, 4); break;
			default: return console.error('Unrecognized attribute type:', attrib.type);
		}
	}

	if (renderable.uniforms.u_time != undefined) {
		gl.uniform1f(renderable.uniforms.u_time.location, performance.now() / 1000);
	}

	if (renderable.elementBuffer != undefined) {
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, renderable.elementBuffer);
		// gl.drawElements(renderable.mode, renderable.count, gl.UNSIGNED_SHORT, 0);
		glInstanced.drawElementsInstancedANGLE(renderable.mode, renderable.count, gl.UNSIGNED_SHORT, 0, attribsAos.length);
	} else {
		// gl.drawArrays(renderable.mode, 0, renderable.count);
		glInstanced.drawArraysInstancedANGLE(renderable.mode, 0, renderable.count, attribsAos.length);
	}

	for (const buffer of Object.values(attribsBuffer)) {
		gl.deleteBuffer(buffer);
	}

	for (const {type, location} of Object.values(renderable.attribs)) {
		switch (type) {
			case gl.FLOAT_MAT2 : for (let i = 0; i < 2; i += 1) gl.disableVertexAttribArray(location + i); break;
			case gl.FLOAT_MAT3 : for (let i = 0; i < 3; i += 1) gl.disableVertexAttribArray(location + i); break;
			case gl.FLOAT_MAT4 : for (let i = 0; i < 4; i += 1) gl.disableVertexAttribArray(location + i); break;
			default: gl.disableVertexAttribArray(location);
		}
	}
}

const octahedronRenderable = createRenderable({
	mode: gl.TRIANGLES,
	count: 8 * 3,
	vertexSrc: `
		attribute vec3 a_pos;

		attribute mat4 a_transform;

		void main() {
			gl_Position = a_transform * vec4(a_pos, 1.0);
		}
	`,
	fragmentSrc: `
		void main() {
			gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
		}
	`,

	arrays: {
		pos: new Float32Array([
			-1, 0, 0, // 0
			+1, 0, 0, // 1
			0, -1, 0, // 2
			0, +1, 0, // 3
			0, 0, -1, // 4
			0, 0, +1, // 5
		]),
	},
	elements: new Uint16Array([
		0, 2, 4,
		0, 2, 5,
		0, 3, 4,
		0, 3, 5,
		1, 2, 4,
		1, 2, 5,
		1, 3, 4,
		1, 3, 5,
	]),
});

const resize = () => {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	aspectRatio = window.innerWidth / window.innerHeight;
	gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
}

resize();
window.onresize = resize;

$('#save-game').addEventListener('click', async () => {
	const blob = new Blob([JSON.stringify(toJSON())]);
	const dataUrl = await new Promise(res => {
		const reader = new FileReader();
		reader.addEventListener('load', () => res(reader.result));
		reader.readAsDataURL(blob);
	});
	const anchor = document.createElement('a');
	anchor.href = dataUrl;
	anchor.download = 'igra-s-lazeri.isl';
	anchor.click();
})

$('#load-game').addEventListener('click', () => {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.isl';
	input.addEventListener('change', async () => {
		const file = input.files[0]
		if (!file) return;
		fromJSON(JSON.parse(await file.text()));
	})
	input.click();
})

$('#new-game').addEventListener('click', () => {
	if (!confirm('Сигурни ли сте че искате да създадете нова игра?')) return;
	fromJSON(JSON.parse(defaultSavedGame));
})

canvas.addEventListener('click', async () => canvas.requestPointerLock());

window.addEventListener('keydown', ({code}) => {
	if (!document.pointerLockElement) return;

	if (code == 'Backquote') $('#debug-info').classList.toggle('hidden');

	isKeyPressed[code] = true;
});

window.addEventListener('keyup', ({code}) => {
	if (!document.pointerLockElement) return;

	isKeyPressed[code] = false;
});

const getBlockForPlacement = () => {
	const [x, y, z] = getCameraFront();

	return {
		type: 'mirror',
		orientation: Math.round(Math.atan2(-x, -z) * 2 / Math.PI + 4) % 4,
		flipped: y > 0,
	}
}

window.addEventListener('mousedown', ({button}) => {
	if (!document.pointerLockElement) return;

	isMousePressed[button] = true;

	if (createPos && button == 0) {
		blocks.set(createPos[0], createPos[1], createPos[2], getBlockForPlacement());
	}

	if (destroyPos && button == 2) {
		blocks.set(destroyPos[0], destroyPos[1], destroyPos[2]);
	}
});

window.addEventListener('mouseup', ({button}) => {
	if (!document.pointerLockElement) return;

	isMousePressed[button] = false;
});

const clamp = (x, min, max) => Math.min(Math.max(x, min), max);

const sign = (x) => {
	if (x == 0) return 0;
	if (x < 0) return -1;
	if (x > 0) return 1;
}

window.addEventListener('mousemove', ev => {
	if (!document.pointerLockElement) return;

	cameraYaw += ev.movementX * fov / gl.drawingBufferWidth;
	cameraPitch = clamp(cameraPitch + ev.movementY * fov / aspectRatio / gl.drawingBufferHeight, -90 * degrees, 90 * degrees);
});

const debugLog = (...args) => {
	console.log(...args);
}

const getCameraFront = () => {
	return Linear.mat4Vec3(
		Linear.multiply(Linear.rotateY(cameraYaw), Linear.rotateX(cameraPitch)),
		[0, 0, 1],
	);
}

const getOutgoing = (block, incoming) => {
	const oneBitSet = (x) => x != 0 && (x & (x - 1)) == 0;

	switch (block.type) {
		case 'air':
			if (!oneBitSet(incoming)) return 0;
			return (incoming << 3 | incoming >> 3) & ((incoming << 6) - 1);
		case 'mirror':
			const [reflectorHor, collector1, transmitterHor, collector2] = [
				[Direction.zPos, Direction.xPos, Direction.zNeg, Direction.xNeg],
				[Direction.xPos, Direction.zNeg, Direction.xNeg, Direction.zPos],
				[Direction.zNeg, Direction.xNeg, Direction.zPos, Direction.xPos],
				[Direction.xNeg, Direction.zPos, Direction.xPos, Direction.zNeg],
			][block.orientation];

			const [reflectorVer, transmitterVer] = {
				false: [Direction.yPos, Direction.yNeg],
				true:  [Direction.yNeg, Direction.yPos],
			}[block.flipped]

			const collectorMask   = (1 << collector1     | 1 << collector2);
			const reflectorMask   = (1 << reflectorHor   | 1 << reflectorVer);
			const transmitterMask = (1 << transmitterHor | 1 << transmitterVer);

			const emitting = incoming & collectorMask;

			let outgoing = 0;

			if (emitting) {
				outgoing |= ~incoming & reflectorMask;
				if (incoming & 1 << transmitterHor) outgoing |= ~incoming & 1 << transmitterVer;
				if (incoming & 1 << transmitterVer) outgoing |= ~incoming & 1 << transmitterHor;

				return outgoing;
			} else {
				if (!oneBitSet(incoming & (transmitterMask | reflectorMask))) return 0;

				if (incoming & 1 << transmitterHor) outgoing |= 1 << reflectorHor;
				if (incoming & 1 << transmitterVer) outgoing |= 1 << reflectorVer;
				if (incoming & 1 << reflectorVer)   outgoing |= 1 << reflectorHor;
				if (incoming & 1 << reflectorHor)   outgoing |= 1 << reflectorVer;

				return outgoing;
			}
	}
}

const tick = () => {
	tickTime = -performance.now();

	let newLasers = new Map3d();

	for (const [x, y, z, incoming] of lasers.entries()) {

		console.assert(incoming != 0);

		const block = blocks.get(x, y, z, {type: 'air'});

		const outgoing = getOutgoing(block, incoming);

		if (outgoing & 1 << Direction.xNeg) newLasers.set(x - 1, y, z, newLasers.get(x - 1, y, z, 0) | 1 << Direction.xPos);
		if (outgoing & 1 << Direction.yNeg) newLasers.set(x, y - 1, z, newLasers.get(x, y - 1, z, 0) | 1 << Direction.yPos);
		if (outgoing & 1 << Direction.zNeg) newLasers.set(x, y, z - 1, newLasers.get(x, y, z - 1, 0) | 1 << Direction.zPos);
		if (outgoing & 1 << Direction.xPos) newLasers.set(x + 1, y, z, newLasers.get(x + 1, y, z, 0) | 1 << Direction.xNeg);
		if (outgoing & 1 << Direction.yPos) newLasers.set(x, y + 1, z, newLasers.get(x, y + 1, z, 0) | 1 << Direction.yNeg);
		if (outgoing & 1 << Direction.zPos) newLasers.set(x, y, z + 1, newLasers.get(x, y, z + 1, 0) | 1 << Direction.zNeg);
	}

	lasers = newLasers;

	tickTime += performance.now();
}

const update = (deltaTime) => {
	updateTime = -performance.now();

	camera: {
		let deltaCameraX = 0;
		let deltaCameraY = 0;
		let deltaCameraZ = 0;

		if (isKeyPressed['KeyD']) deltaCameraX += 1;
		if (isKeyPressed['KeyA']) deltaCameraX -= 1;
		if (isKeyPressed['KeyW']) deltaCameraZ += 1;
		if (isKeyPressed['KeyS']) deltaCameraZ -= 1;
		if (isKeyPressed['KeyE']) deltaCameraY += 1;
		if (isKeyPressed['KeyQ']) deltaCameraY -= 1;

		const mag = Math.hypot(deltaCameraX, deltaCameraY, deltaCameraZ);

		if (!mag) break camera;

		deltaCameraX /= mag;
		deltaCameraY /= mag;
		deltaCameraZ /= mag;

		deltaCameraX *= cameraSpeed * deltaTime;
		deltaCameraY *= cameraSpeed * deltaTime;
		deltaCameraZ *= cameraSpeed * deltaTime;

		[deltaCameraX, deltaCameraY, deltaCameraZ] = Linear.mat4Vec3(
			Linear.rotateY(cameraYaw),
			[deltaCameraX, deltaCameraY, deltaCameraZ],
		);

		cameraX += deltaCameraX;
		cameraY += deltaCameraY;
		cameraZ += deltaCameraZ;
	}

	rayCast: {
		const [dX, dY, dZ] = getCameraFront();
		const offsetX = dX < 0 ? 1 : 0;
		const offsetY = dY < 0 ? 1 : 0;
		const offsetZ = dZ < 0 ? 1 : 0;

		let curX = Math.floor(cameraX) + sign(dX);
		let curY = Math.floor(cameraY) + sign(dY);
		let curZ = Math.floor(cameraZ) + sign(dZ);

		// while (true) {
		for (let i = 0; i < 100; i += 1) {
			let kX = (curX + offsetX - cameraX) / dX;
			let kY = (curY + offsetY - cameraY) / dY;
			let kZ = (curZ + offsetZ - cameraZ) / dZ;

			if (dX == 0) kX = Infinity;
			if (dY == 0) kY = Infinity;
			if (dZ == 0) kZ = Infinity;

			let k = Math.min(kX, kY, kZ);

			if (k > 10) {
				createPos = null;
				destroyPos = null;
				break rayCast;
			};

			let castX;
			let castY;
			let castZ;

			let castNormalX;
			let castNormalY;
			let castNormalZ;

			if (k == kX) {
				castX = curX;
				castY = Math.floor(dY * k + cameraY);
				castZ = Math.floor(dZ * k + cameraZ);

				curX += sign(dX);

				castNormalX = -sign(dX);
				castNormalY = 0;
				castNormalZ = 0;
			} else if (k == kY) {
				castX = Math.floor(dX * k + cameraX);
				castY = curY;
				castZ = Math.floor(dZ * k + cameraZ);

				curY += sign(dY);

				castNormalX = 0;
				castNormalY = -sign(dY);
				castNormalZ = 0;
			} else if (k == kZ) {
				castX = Math.floor(dX * k + cameraX);
				castY = Math.floor(dY * k + cameraY);
				castZ = curZ;

				curZ += sign(dZ);

				castNormalX = 0;
				castNormalY = 0;
				castNormalZ = -sign(dZ);
			}

			const block = blocks.get(castX, castY, castZ, {type: 'air'});
			if (block.type != 'air') {
				destroyPos = [castX, castY, castZ];
				createPos = [castX + castNormalX, castY + castNormalY, castZ + castNormalZ];
				break rayCast;
			}

			const incoming = lasers.get(castX, castY, castZ, 0);
			if (incoming) {
				const mask = incoming | getOutgoing(block, incoming);

				let minDistanceSquared = Infinity;

				const updateMinDistanceSquared = (posX, posY, posZ, dX, dY, dZ, cylinderX, cylinderY, cylinderZ1, cylinderZ2) => {
					const tryK = (k) => {
						if (k * dZ + posZ < cylinderZ1 || k * dZ + posZ > cylinderZ2) return;
						minDistanceSquared = Math.min(minDistanceSquared, 0
							+ (k * dX + posX - cylinderX) ** 2
							+ (k * dY + posY - cylinderY) ** 2
						);
					}

					if (dZ != 0) {
						for (const cylinderZ of [cylinderZ1, cylinderZ2]) {
							tryK((cylinderZ - posZ) / dZ)
						}
					}

					tryK((dX * (cylinderX - posX) + dY * (cylinderY - posY)) / (dX ** 2 + dY ** 2));
				}

				// NAPRAVI go po-qetlivo
				if (mask & 1 << Direction.xNeg) updateMinDistanceSquared(cameraY, cameraZ, cameraX, dY, dZ, dX, castY + 0.5, castZ + 0.5, castX + 0.0, castX + 0.5);
				if (mask & 1 << Direction.xPos) updateMinDistanceSquared(cameraY, cameraZ, cameraX, dY, dZ, dX, castY + 0.5, castZ + 0.5, castX + 0.5, castX + 1.0);
				if (mask & 1 << Direction.yNeg) updateMinDistanceSquared(cameraZ, cameraX, cameraY, dZ, dX, dY, castZ + 0.5, castX + 0.5, castY + 0.0, castY + 0.5);
				if (mask & 1 << Direction.yPos) updateMinDistanceSquared(cameraZ, cameraX, cameraY, dZ, dX, dY, castZ + 0.5, castX + 0.5, castY + 0.5, castY + 1.0);
				if (mask & 1 << Direction.zNeg) updateMinDistanceSquared(cameraX, cameraY, cameraZ, dX, dY, dZ, castX + 0.5, castY + 0.5, castZ + 0.0, castZ + 0.5);
				if (mask & 1 << Direction.zPos) updateMinDistanceSquared(cameraX, cameraY, cameraZ, dX, dY, dZ, castX + 0.5, castY + 0.5, castZ + 0.5, castZ + 1.0);

				if (minDistanceSquared < (laserRadius / Math.sqrt(2)) ** 2) {
					destroyPos = null;
					createPos = [castX, castY, castZ];
					break rayCast;
				}
			}
		}

		console.error('should not have gotten here!');
	}

	if (isKeyPressed['Minus']) fov = Math.max(fov - 50 * degrees * deltaTime, 20 * degrees);
	if (isKeyPressed['Equal']) fov = Math.min(fov + 50 * degrees * deltaTime, 170 * degrees);

	updateTime += performance.now();
}

gl.enable(gl.DEPTH_TEST);

const renderableAndTransformFromBlock = (block) => {
	let transform = Linear.identity();
	let renderable = null;
	switch(block.type) {
		case 'mirror':
			transform = Linear.multiply(Linear.rotateY(block.orientation * Math.PI / 2), transform);
			transform = Linear.multiply(Linear.scale(1, block.flipped ? -1 : 1, 1), transform);
			renderable = mirrorRenderable;
			break;
	}
	return [renderable, transform];
}

const draw = () => {
	drawTime = -performance.now();

	const forRendering = new Map();

	const addForRendering = (renderable, attribs) => {
		if (!forRendering.has(renderable)) forRendering.set(renderable, []);
		forRendering.get(renderable).push(attribs);
	}

	gl.clearColor(0.8, 1.0, 1.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	let view = Linear.identity();
	view = Linear.multiply(Linear.translate(-cameraX, -cameraY, -cameraZ), view);
	view = Linear.multiply(Linear.rotateY(-cameraYaw), view);
	view = Linear.multiply(Linear.rotateX(-cameraPitch), view);

	const projection = Linear.perspective(fov, aspectRatio);

	// const closeEnough = (x, y, z) => Math.hypot(x - cameraX, y - cameraY, z - cameraZ) < 30;

	for (const [x, y, z, incoming] of lasers.entries()) {
		const models = [];

		const block = blocks.get(x, y, z, {type: 'air'});
		const outgoing = getOutgoing(block, incoming);

		// NAPRAVI go po-qetimo
		for (let i = 0; i < 2; i += 1) {
			const mask = [incoming, outgoing][i];
			const transform = [Linear.identity(), Linear.multiply(Linear.translate(0, 0, 1), Linear.scale(1, 1, -1))][i];

			if (mask & 1 << Direction.xNeg) models.push(Linear.multiply(Linear.scale(-1, 1, 1), Linear.rotateY(+90 * degrees), transform));
			if (mask & 1 << Direction.yNeg) models.push(Linear.multiply(Linear.scale(1, -1, 1), Linear.rotateX(-90 * degrees), transform));
			if (mask & 1 << Direction.zNeg) models.push(Linear.multiply(Linear.scale(1, 1, -1), Linear.identity(),             transform));
			if (mask & 1 << Direction.xPos) models.push(Linear.multiply(                        Linear.rotateY(+90 * degrees), transform));
			if (mask & 1 << Direction.yPos) models.push(Linear.multiply(                        Linear.rotateX(-90 * degrees), transform));
			if (mask & 1 << Direction.zPos) models.push(Linear.multiply(                        Linear.identity(),             transform));
		}

		const cubeTransform = Linear.multiply(Linear.translate(x + 0.5, y + 0.5, z + 0.5), Linear.scale(0.5, 0.5, 0.5));

		for (const it of models) {
			const model = Linear.multiply(cubeTransform, it);
			addForRendering(laserRenderable, {model, view, projection});
		}
	}

	for (const [x, y, z, block] of blocks.entries()) {
		let [renderable, model] = renderableAndTransformFromBlock(block);

		if (renderable == null) {
			console.warn('Not rendering block at', x, y, z, 'with type', block.type);
			continue;
		}

		model = Linear.multiply(Linear.scale(0.5, 0.5, 0.5), model);
		model = Linear.multiply(Linear.translate(x + 0.5, y + 0.5, z + 0.5), model);

		addForRendering(renderable, {model, view, projection});
	}

	hover: if (createPos) {
		let [renderable, model] = renderableAndTransformFromBlock(getBlockForPlacement());

		if (renderable == null) {
			console.warn('Not rendering hover block with type', block.type);
			break hover;
		}

		model = Linear.multiply(Linear.scale(0.1, 0.1, 0.1), model);
		model = Linear.multiply(
			Linear.translate(
				createPos[0] + 0.5,
				createPos[1] + 0.5,
				createPos[2] + 0.5,
			),
			model,
		);

		addForRendering(renderable, {model, view, projection});
	}

	crosshair: {
		let transform = Linear.identity();

		transform = Linear.multiply(Linear.scale(0.01, 0.01, 0.01), transform);
		transform = Linear.multiply(Linear.translate(0, 0, -1), transform);

		addForRendering(octahedronRenderable, {transform});
	}

	let count = 0;
	for (const [renderable, attribs] of forRendering.entries()) {
		renderBatch(renderable, attribs);
		count += attribs.length;
	}

	drawTime += performance.now();

	$('#debug-info').innerText = [
		`tick time [ms] -- ${tickTime}`,
		`draw time [ms] -- ${drawTime}`,
		`update time [ms] -- ${updateTime}`,
		`render count -- ${count}`,
	].join('\n');
}

const renderableDefinitionFromObjAndPng = async (path) => {
	const response = await fetch(`${path}.obj`);
	const raw = await response.text();

	const vp = [];
	const vt = [];
	const vn = [];

	const fp = [];
	const ft = [];
	const fn = [];

	let vertexCount = 0;

	for (const line of raw.split('\n')) {
		const [command, ...values] = line.split(' ');

		switch (command) {
			case 'v':  vp.push(values); break;
			case 'vt': vt.push([values[0], -values[1]]); break;
			case 'vn': vn.push(values); break;
			case '#': break;
			case 'f':
				console.assert(values.length == 3);

				vertexCount += values.length;

				for (const it of values) {
					let [vpIdx, vtIdx, vnIdx] = it.split('/').map(x => Number(x) - 1);

					fp.push(...vp[vpIdx]);
					ft.push(...vt[vtIdx]);
					fn.push(...vn[vnIdx]);
				}
				break;
			default: console.log('Ignoring obj line:', line);
		}
	}

	const img = document.createElement('img');
	await new Promise((res => {
		img.onload = res;
		img.src = `${path}.png`;
	}))

	return createRenderable({
		mode: gl.TRIANGLES,
		count: vertexCount,
		arrays: {
			position: new Float32Array(fp),
			texture:  new Float32Array(ft),
			normal:   new Float32Array(fn),
		},
		vertexSrc: `
			attribute vec3 a_position;
			attribute vec2 a_texture;
			attribute vec3 a_normal;

			attribute mat4 a_model;
			attribute mat4 a_view;
			attribute mat4 a_projection;

			varying vec2 v_texture;
			varying vec3 v_normal;

			void main() {
				gl_Position = a_projection * a_view * a_model * vec4(a_position, 1.0);

				v_texture = a_texture;

				mediump mat4 normal_transform = a_model;
				normal_transform[3] = vec4(0.0, 0.0, 0.0, 1.0);
				v_normal = normalize((normal_transform * vec4(a_normal, 1.0)).xyz);
			}
		`,
		fragmentSrc: `
			varying mediump vec2 v_texture;
			varying mediump vec3 v_normal;

			uniform sampler2D t_diffuse;

			void main() {
				lowp float sun_darkness = dot(normalize(vec3(-0.5, -1.0, -0.3)), v_normal) * 0.5 + 0.5;
				lowp float ambient_darkness = 0.50;

				lowp float darkness = sun_darkness * ambient_darkness;

				gl_FragColor = vec4(texture2D(t_diffuse, v_texture).rgb * (1.0 - darkness), 1.0);
			}
		`,
		images: [img],
	});
}

const saveToLocalStorage = () => {
	localStorage.setItem('savedGame', JSON.stringify(toJSON()));
}

const intervals = [
	{ callback: draw,               minInterval:    0 },
	{ callback: update,             minInterval:    0 },
	{ callback: tick,               minInterval:  250 },
	{ callback: saveToLocalStorage, minInterval: 1000 },
];

for (const it of intervals) it.then = performance.now();

const onAnimationFrame = () => {
	window.requestAnimationFrame(onAnimationFrame);

	for (const it of intervals) {
		const now = performance.now();

		const actualInterval = now - it.then;

		if (actualInterval > it.minInterval) {
			it.then = now;
			it.callback(actualInterval / 1000);
		}
	}
}

const setup = async () => {
	mirrorRenderable = createRenderable(await renderableDefinitionFromObjAndPng('assets/ogledalo'));

	laserRenderable  = createRenderable({
		...await renderableDefinitionFromObjAndPng('assets/lazer'),
		fragmentSrc: `
			varying mediump vec2 v_texture;
			varying mediump vec3 v_normal;

			uniform sampler2D t_diffuse;

			uniform mediump float u_time;

			void main() {
				gl_FragColor = vec4(texture2D(t_diffuse, v_texture + vec2(0.0, u_time)).rgb, 1.0);
			}
		`,
	});

	fromJSON(JSON.parse(localStorage.getItem('savedGame') ?? defaultSavedGame));

	window.requestAnimationFrame(onAnimationFrame);
}

setup();

const toJSON = () => {
	return {
		version: currentVersion,
		cameraYaw,
		cameraPitch,
		cameraX,
		cameraY,
		cameraZ,
		blocks: blocks.toJSON(),
		lasers: lasers.toJSON(),
	}
}

const fromJSON = (json) => {
	if (json.version != currentVersion) return `save file version is ${json.version}, current version is ${currentVersion}`;

	cameraYaw   = json.cameraYaw;
	cameraPitch = json.cameraPitch;
	cameraX     = json.cameraX;
	cameraY     = json.cameraY;
	cameraZ     = json.cameraZ;

	blocks = new Map3d(json.blocks);
	lasers = new Map3d(json.lasers);

	return null;
}
