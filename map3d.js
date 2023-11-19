class Map3d {
	constructor(entries=[]) {
		this.map = new Map();

		for (const [x, y, z, v] of entries) this.set(x, y, z, v);
	};

	get(x, y, z, fallback) {
		const value = this.map.get(x)?.get(y)?.get(z);
		if (value !== undefined) return value;
		return fallback;
	}

	set(x, y, z, v) {
		const getX = this.map.get(x);
		if (getX === undefined) return this.map.set(x, new Map([[y, new Map([[z, v]])]]));

		const getY = getX.get(y);
		if (getY === undefined) return getX.set(y, new Map([[z, v]]));

		if (v === undefined) getY.delete(z);
		else                 getY.set   (z, v);
	}

	*entries() {
		for (const [x, getX] of this.map.entries()) {
			for (const [y, getY] of getX.entries()) {
				for (const [z, getZ] of getY.entries()) {
					yield [x, y, z, getZ];
				}
			}
		}
	}

	toJSON() {
		return Array.from(this.entries());
	}
}
