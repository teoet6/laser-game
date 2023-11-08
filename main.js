const degrees = Math.PI / 180;

const canvas = document.querySelector('#canvas');
const gl = canvas.getContext('webgl');

let fov = 90 * degrees;

let cameraSpeed = 0.2;
let cameraYaw = 45 * degrees;
let cameraPitch = 45 * degrees;
let cameraZ = -1.5;
let cameraY = 2.5;
let cameraX = -1.5;

let aspectRatio = 1;

let isHovering = false;
let hoverX;
let hoverY;
let hoverZ;
let hoverK;
let hoverNormalX;
let hoverNormalY;
let hoverNormalZ;

let debug = false;

let blocks = new Map3d();
let lasers = new Map3d();

let mirrorRenderable = null;

const perspectiveNear = 0.1;
const perspectiveFar = 100;

const isKeyPressed = {};
const isMousePressed = {};

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
		if (!gl.getShaderParameter(renderable.vertexShader, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(renderable.vertexShader));
	}

	if (renderable.fragmentSrc != undefined) {
		renderable.fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(renderable.fragmentShader, renderable.fragmentSrc);
		gl.compileShader(renderable.fragmentShader);
		if (!gl.getShaderParameter(renderable.fragmentShader, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(renderable.fragmentShader));
	}

	if (renderable.vertexShader != undefined && renderable.fragmentShader != undefined) {
		renderable.program = gl.createProgram();
		gl.attachShader(renderable.program, renderable.vertexShader);
		gl.attachShader(renderable.program, renderable.fragmentShader);
		gl.linkProgram(renderable.program);

		if (!gl.getProgramParameter(renderable.program, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(renderable.program));
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
			};
		}

		console.log(renderable.attribs);
	}

	if (!renderable.mode) console.error('Rendering mode not specified')
	if (!renderable.count) console.error('Rendering count not specified')

	return renderable;
}

const render = (renderable, attribs={}) => {
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
				default: console.error('Unrecognized attribute type:', attrib.type); debugger;
			}
		}
	}

	if (renderable.textures != undefined) {
		for (let idx = 0; idx < renderable.textures.length; idx += 1) {
			gl.activeTexture(gl.TEXTURE0 + idx);
			gl.bindTexture(gl.TEXTURE_2D, renderable.textures[idx]);
		}
	}

	for (const [name, value] of Object.entries(attribs)) {
		const attrib = renderable.attribs['a_' + name];
		gl.disableVertexAttribArray(attrib.location);

		switch (attrib.type) {
			case gl.FLOAT      : gl.vertexAttrib1fv(attrib.location, value); break;
			case gl.FLOAT_VEC2 : gl.vertexAttrib2fv(attrib.location, value); break;
			case gl.FLOAT_VEC3 : gl.vertexAttrib3fv(attrib.location, value); break;
			case gl.FLOAT_VEC4 : gl.vertexAttrib4fv(attrib.location, value); break;

			case gl.FLOAT_MAT2:
				for (let i = 0; i < 2; i += 1) {
					gl.disableVertexAttribArray(attrib.location + i);
					gl.vertexAttrib2fv(attrib.location + i, value.slice(i * 2, (i+1) * 2));
				}
				break;
			case gl.FLOAT_MAT3:
				for (let i = 0; i < 3; i += 1) {
					gl.disableVertexAttribArray(attrib.location + i);
					gl.vertexAttrib3fv(attrib.location + i, value.slice(i * 3, (i+1) * 3));
				}
				break;
			case gl.FLOAT_MAT4:
				for (let i = 0; i < 4; i += 1) {
					gl.disableVertexAttribArray(attrib.location + i);
					gl.vertexAttrib4fv(attrib.location + i, value.slice(i * 4, (i+1) * 4));
				}
				break;
			default: console.error('Unrecognized attribute type:', attrib.type); debugger;
		}
	}

	// for (const [name, value] of Object.entries(uniforms)) {
	// 	const location = gl.getUniformLocation(renderable.program, 'u_' + name);
	// 	const uniform = gl.getActiveUniform(renderable.program, location);

	// 	switch (uniform.type) {
	// 		case gl.FLOAT      : gl.uniform1fj(location, value); break;
	// 		case gl.FLOAT_VEC2 : gl.uniform2fv(location, value); break;
	// 		case gl.FLOAT_VEC3 : gl.uniform3fv(location, value); break;
	// 		case gl.FLOAT_VEC4 : gl.uniform4fv(location, value); break;
	// 		case gl.INT        : gl.uniform1iv(location, value); break;
	// 		case gl.INT_VEC2   : gl.uniform2iv(location, value); break;
	// 		case gl.INT_VEC3   : gl.uniform3iv(location, value); break;
	// 		case gl.INT_VEC4   : gl.uniform4iv(location, value); break;
	// 		case gl.FLOAT_MAT2 : gl.uniformMatrix2fv(location, false, value); break;
	// 		case gl.FLOAT_MAT3 : gl.uniformMatrix3fv(location, false, value); break;
	// 		case gl.FLOAT_MAT4 : gl.uniformMatrix4fv(location, false, value); break;
	// 		default: console.error('Unrecognized uniform type:', attrib.type);
	// 	}
	// }

	if (renderable.elementBuffer != undefined) {
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, renderable.elementBuffer);
		gl.drawElements(renderable.mode, renderable.count, gl.UNSIGNED_SHORT, 0);
	} else {
		gl.drawArrays(renderable.mode, 0, renderable.count);
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

const laserRenderable = createRenderable({
	mode: gl.TRIANGLES,
	count: 8 * 3,
	vertexSrc: `
		attribute vec3 a_pos;

		attribute mat4 a_model;
		attribute mat4 a_view;
		attribute mat4 a_projection;

		void main() {
			gl_Position = a_projection * a_view * a_model * vec4(a_pos, 1.0);
			// gl_Position = a_projection * a_view * vec4(a_pos, 1.0);
		}
	`,
	fragmentSrc: `
		void main() {
			gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
		}
	`,

	arrays: {
		pos: new Float32Array([
			0, -0.05, -0.05,
			0, -0.05, +0.05,
			0, +0.05, +0.05,
			0, +0.05, -0.05,

			1, -0.05, -0.05,
			1, -0.05, +0.05,
			1, +0.05, +0.05,
			1, +0.05, -0.05,
		]),
	},
	elements: new Uint16Array([
		0, 1, 4,
		4, 5, 1,
		1, 2, 5,
		5, 6, 2,
		2, 3, 6,
		6, 7, 3,
		3, 0, 7,
		7, 4, 0,
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

canvas.addEventListener('click', async () => canvas.requestPointerLock());

window.addEventListener('keydown', ({code}) => {
	if (!document.pointerLockElement) return;

	isKeyPressed[code] = true;

	if (code == 'Space') debug = true;
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

	if (isHovering && button == 2) {
		blocks.set(hoverX + hoverNormalX, hoverY + hoverNormalY, hoverZ + hoverNormalZ, getBlockForPlacement());
	}

	if (isHovering && button == 0) {
		blocks.set(hoverX, hoverY, hoverZ);
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
	if (!debug) return;
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
	let newLasers = new Map3d();

	for (const [x, y, z, incoming] of lasers.entries()) {
		// if (Math.abs(x) > 30 || Math.abs(y) > 30 || Math.abs(z) > 30) continue;

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

	newLasers.set(-10, 0, 0, 1 << 0);

	lasers = newLasers;
}

const update = () => {
	camera: {
		let deltaCameraX = 0;
		let deltaCameraY = 0;
		let deltaCameraZ = 0;

		if (isKeyPressed['KeyD']) deltaCameraX += 1;
		if (isKeyPressed['KeyA']) deltaCameraX -= 1;
		if (isKeyPressed['KeyW']) deltaCameraZ += 1;
		if (isKeyPressed['KeyS']) deltaCameraZ -= 1;
		if (isKeyPressed['KeyQ']) deltaCameraY += 1;
		if (isKeyPressed['KeyE']) deltaCameraY -= 1;

		const mag = Math.hypot(deltaCameraX, deltaCameraY, deltaCameraZ);

		if (!mag) break camera;

		deltaCameraX /= mag;
		deltaCameraY /= mag;
		deltaCameraZ /= mag;

		deltaCameraX *= cameraSpeed;
		deltaCameraY *= cameraSpeed;
		deltaCameraZ *= cameraSpeed;

		[deltaCameraX, deltaCameraY, deltaCameraZ] = Linear.mat4Vec3(
			Linear.rotateY(cameraYaw),
			[deltaCameraX, deltaCameraY, deltaCameraZ],
		);

		cameraX += deltaCameraX;
		cameraY += deltaCameraY;
		cameraZ += deltaCameraZ;
	}

	hover: {
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

			hoverK = Math.min(kX, kY, kZ);

			if (hoverK > 10) {
				isHovering = false;
				break hover;
			};

			if (hoverK == kX) {
				hoverX = curX;
				hoverY = Math.floor(dY * hoverK + cameraY);
				hoverZ = Math.floor(dZ * hoverK + cameraZ);

				curX += sign(dX);

				hoverNormalX = -sign(dX);
				hoverNormalY = 0;
				hoverNormalZ = 0;
			} else if (hoverK == kY) {
				hoverX = Math.floor(dX * hoverK + cameraX);
				hoverY = curY;
				hoverZ = Math.floor(dZ * hoverK + cameraZ);

				curY += sign(dY);

				hoverNormalX = 0;
				hoverNormalY = -sign(dY);
				hoverNormalZ = 0;
			} else if (hoverK == kZ) {
				hoverX = Math.floor(dX * hoverK + cameraX);
				hoverY = Math.floor(dY * hoverK + cameraY);
				hoverZ = curZ;

				curZ += sign(dZ);

				hoverNormalX = 0;
				hoverNormalY = 0;
				hoverNormalZ = -sign(dZ);
			}

			if (blocks.get(hoverX, hoverY, hoverZ)) {
				isHovering = true;
				break hover;
			}
		}

		console.error('should not have gotten here!');
	}

	if (isKeyPressed['Minus']) fov = Math.max(fov - 1 * degrees, 40 * degrees);
	if (isKeyPressed['Equal']) fov = Math.min(fov + 1 * degrees, 170 * degrees);
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
	window.requestAnimationFrame(draw);

	gl.clearColor(0.8, 1.0, 1.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	let view = Linear.identity();
	view = Linear.multiply(Linear.translate(-cameraX, -cameraY, -cameraZ), view);
	view = Linear.multiply(Linear.rotateY(-cameraYaw), view);
	view = Linear.multiply(Linear.rotateX(-cameraPitch), view);

	const projection = Linear.perspective(fov, aspectRatio);

	for (const [x, y, z, incoming] of lasers.entries()) {
		const models = [];

		const block = blocks.get(x, y, z, {type: 'air'});
		const outgoing = getOutgoing(block, incoming);

		for (const mask of [incoming, outgoing]) {
			if (mask & 1 << Direction.xNeg) models.push(Linear.rotateZ(180 * degrees));
			if (mask & 1 << Direction.yNeg) models.push(Linear.rotateZ(-90 * degrees));
			if (mask & 1 << Direction.zNeg) models.push(Linear.rotateY(+90 * degrees));
			if (mask & 1 << Direction.xPos) models.push(Linear.identity());
			if (mask & 1 << Direction.yPos) models.push(Linear.rotateZ(+90 * degrees));
			if (mask & 1 << Direction.zPos) models.push(Linear.rotateY(-90 * degrees));
		}

		const cubeTransform = Linear.multiply(Linear.translate(x + 0.5, y + 0.5, z + 0.5), Linear.scale(0.5, 0.5, 0.5));

		for (const it of models) {
			const model = Linear.multiply(cubeTransform, it);
			render(laserRenderable, {model, view, projection});
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

		render(renderable, {model, view, projection});
	}

	hover: if (isHovering) {
		let [renderable, model] = renderableAndTransformFromBlock(getBlockForPlacement());

		if (renderable == null) {
			console.warn('Not rendering hover block with type', block.type);
			break hover;
		}

		model = Linear.multiply(Linear.scale(0.1, 0.1, 0.1), model);
		model = Linear.multiply(
			Linear.translate(
				hoverX + hoverNormalX + 0.5,
				hoverY + hoverNormalY + 0.5,
				hoverZ + hoverNormalZ + 0.5,
			),
			model,
		);

		render(renderable, {model, view, projection});
	}

	crosshair: {
		let transform = Linear.identity();

		transform = Linear.multiply(Linear.scale(0.01, 0.01, 0.01), transform);
		transform = Linear.multiply(Linear.translate(0, 0, -1), transform);

		render(octahedronRenderable, {transform});
	}
}

const createRenderableFromObjAndPng = async (path) => {
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
			default: console.log('Ignoring line:', line);
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

				lowp vec3 color = texture2D(t_diffuse, v_texture).xyz * (1.0 - darkness);

				gl_FragColor = vec4(vec3(color), 1.0);

				// gl_FragColor = vec4(v_normal, 1.0);
			}
		`,
		images: [img],
	});
}

const setup = async () => {
	mirrorRenderable = await createRenderableFromObjAndPng('assets/ogledalo');

	blocks.set(0, 0, 0, {
		type: 'mirror',
		orientation: 0,
		flipped: false,
	});

	window.requestAnimationFrame(draw);
	window.setInterval(update, 10);
	window.setInterval(tick,  250);
}

setup();
