// Column major
class Linear {
	static multiply(a, b) {
		const c = new Float32Array(16);
		for (let col = 0; col < 4; col += 1) {
			for (let idx = 0; idx < 4; idx += 1) {
				for (let row = 0; row < 4; row += 1) {
					c[col * 4 + row] += a[idx * 4 + row] * b[col * 4 + idx];
				}
			}
		}
		return c;
	}

	static identity() {
		const ret = new Float32Array(16);
		for (let idx = 0; idx < 4; idx += 1) {
			ret[idx * 4 + idx] = 1;
		}
		return ret;
	}

	static translate(x, y, z) {
		const ret = Linear.identity();
		ret[3 * 4 + 0] = x;
		ret[3 * 4 + 1] = y;
		ret[3 * 4 + 2] = z;
		return ret;
	}

	static scale(x, y, z) {
		const ret = Linear.identity();
		ret[0 * 4 + 0] = x;
		ret[1 * 4 + 1] = y;
		ret[2 * 4 + 2] = z;
		return ret;
	}

	static rotateZ(theta) {
		const s = Math.sin(theta);
		const c = Math.cos(theta);

		const ret = Linear.identity();

		ret[0 * 4 + 0] = c;
		ret[1 * 4 + 0] = -s;
		ret[0 * 4 + 1] = s;
		ret[1 * 4 + 1] = c;

		return ret;
	}

	static rotateY(theta) {
		const s = Math.sin(theta);
		const c = Math.cos(theta);

		const ret = Linear.identity();

		ret[0 * 4 + 0] = c;
		ret[2 * 4 + 0] = s;
		ret[0 * 4 + 2] = -s;
		ret[2 * 4 + 2] = c;

		return ret;
	}

	static rotateX(theta) {
		const s = Math.sin(theta);
		const c = Math.cos(theta);

		const ret = Linear.identity();

		ret[1 * 4 + 1] = c;
		ret[2 * 4 + 1] = -s;
		ret[1 * 4 + 2] = s;
		ret[2 * 4 + 2] = c;

		return ret;
	}

	static perspectiveFrustrum(width, height, near, far) {
		const ret = new Float32Array(16);
		ret[0 * 4 + 0] = 2 * near / width;
		ret[1 * 4 + 1] = 2 * near / height;
		ret[2 * 4 + 2] = (far + near) / (far - near);
		ret[3 * 4 + 2] = 2 * near * far / (near - far);
		ret[2 * 4 + 3] = 1;

		return ret;
	}

	static perspective(fov, aspectRatio, near=perspectiveNear, far=perspectiveFar) {
		const width = 2 * near * Math.sin(fov / 2);
		const height = width / aspectRatio;
		return Linear.perspectiveFrustrum(width, height, near, far);
	}

	static mat4Vec3(mat, vec) {
		const x =
			+ mat[0 * 4 + 0] * vec[0]
			+ mat[1 * 4 + 0] * vec[1]
			+ mat[2 * 4 + 0] * vec[2]
			+ mat[3 * 4 + 0]
		;

		const y =
			+ mat[0 * 4 + 1] * vec[0]
			+ mat[1 * 4 + 1] * vec[1]
			+ mat[2 * 4 + 1] * vec[2]
			+ mat[3 * 4 + 1]
		;

		const z =
			+ mat[0 * 4 + 2] * vec[0]
			+ mat[1 * 4 + 2] * vec[1]
			+ mat[2 * 4 + 2] * vec[2]
			+ mat[3 * 4 + 2]
		;

		const w =
			+ mat[0 * 4 + 3] * vec[0]
			+ mat[1 * 4 + 3] * vec[1]
			+ mat[2 * 4 + 3] * vec[2]
			+ mat[3 * 4 + 3]
		;

		return [x / w, y / w, z / w];
	}
}
