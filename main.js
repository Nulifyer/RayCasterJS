'use strict';

const wait = ms => new Promise(res => setTimeout(res, ms));

class KeyBoardState {
    #numPressed;
    #keys;

    constructor(win) {
        this.#keys = new Map();
        this.#numPressed = 0;

        win.addEventListener('keydown', (e) => {
            ++this.#numPressed;
            this.#keys.set(this.#getKeyFromEvent(e), true);
        });
        win.addEventListener('keyup', (e) => {
            this.#numPressed = Math.max(0, --this.#numPressed);
            this.#keys.set(this.#getKeyFromEvent(e), false);
        });
        win.addEventListener('blur', (e) => { this.reset(); });
        win.addEventListener('contextmenu', (e) => { this.reset(); });
    }

    reset() {
        this.#numPressed = 0;
        this.#keys.clear();
    }

    #getKeyFromEvent(e) {
        return e.key?.toUpperCase();
    }

    isPressed(key) {
        return this.#keys.get(key?.toUpperCase()) === true;
    }
    isAnyPressed(...keys) {
        if (keys === undefined || keys.length === 0)
            return this.#numPressed > 0;
        return keys.map(k => this.isPressed(k)).some(p => p);
    }
    isAllPressed(...keys) {
        return keys.map(k => this.isPressed(k)).every(p => p);
    }
}
class KeyBoardController {
    #state;

    constructor(win) {
        this.#state = new KeyBoardState(win);
    }

    isPressed(key) {
        return this.#state.isPressed(key);
    }
    isAnyPressed(...keys) {
        return this.#state.isAnyPressed(...keys);
    }
    isAllPressed(...keys) {
        return this.#state.isAllPressed(...keys);
    }
}

class Ray {
    #angle;
    get angle() { return this.#angle; }
    set angle(value) {
        this.#angle = (value + 360) % 360;
        this.update();
    }

    #pos;
    get pos() { return this.#pos; }
    set pos(value) {
        this.#pos = value;
        this.update();
    }

    #len;
    get len() { return this.#len; }
    set len(value) {
        this.#len = value;
        this.update();
    }

    #end;
    get end() { return this.#end.copy(); }

    constructor(pos, angle, len) {
        this.#pos = pos;
        this.#angle = angle;
        this.#len = len;
        this.update();
    }

    update() {
        this.#end = p5.Vector
            .fromAngle(radians(this.#angle))
            .mult(this.#len)
            .add(this.#pos);
    }

    lookAt(x, y) {
        if (x instanceof p5.Vector)
            return this.lookAt(x.x, x.y);
        this.#end.x = x - this.pos.x;
        this.#end.y = y - this.pos.y;
        this.#angle = degrees(this.#end.heading());
        this.update();
    }

    isOnRay(vector) {
        return (
            (
                (this.#pos.x <= this.#end.x)
                    ? (this.#pos.x <= vector.x && vector.x <= this.#end.x)
                    : (this.#end.x <= vector.x && vector.x <= this.#pos.x)
            )
            &&
            (
                (this.#pos.y <= this.#end.y)
                    ? (this.#pos.y <= vector.y && vector.y <= this.#end.y)
                    : (this.#end.y <= vector.y && vector.y <= this.#pos.y)
            )
        );
    }

    intersects(x1, y1, x2, y2) {
        if (x1 instanceof Ray) {
            const ip = Ray.intersectionPoint(this, x1);
            return { int: this.isOnRay(ip), ip: ip };
        }
        if (x1 instanceof p5.Vector && y1 instanceof p5.Vector) {
            return this.intersects(Ray.fromVectors(x1, y1));
        }
        return this.intersects(createVector(x1, y1), createVector(x2, y2));
    }

    draw() {
        line(this.pos.x, this.pos.y, this.#end.x, this.#end.y);
    }

    static intersectionPoint(rayA, rayB) {
        const den = (
            (rayB.end.y - rayB.pos.y) * (rayA.end.x - rayA.pos.x) -
            (rayB.end.x - rayB.pos.x) * (rayA.end.y - rayA.pos.y)
        );

        const ua = (
            (rayB.end.x - rayB.pos.x) * (rayA.pos.y - rayB.pos.y) -
            (rayB.end.y - rayB.pos.y) * (rayA.pos.x - rayB.pos.x)
        ) / den;

        // const ub = (
        //     (rayA.end.x - rayA.pos.x) * (rayA.pos.y - rayB.pos.y) -
        //     (rayA.end.y - rayA.pos.y) * (rayA.pos.x - rayB.pos.x)
        // ) / den;

        const x = rayA.pos.x + ua * (rayA.end.x - rayA.pos.x);
        const y = rayA.pos.y + ua * (rayA.end.y - rayA.pos.y);

        return createVector(x, y);
    }

    static fromVectors(vecA, VecB) {
        const r = new Ray(vecA, 0, vecA.dist(VecB));
        r.lookAt(VecB);
        return r;
    }
}

class Player {
    #heading;
    get heading() { return this.#heading; }
    set heading(value) {
        this.#heading = value % 360;
        this.#buildRays();
    }

    #pos;
    get pos() { return this.#pos; }
    set pos(value) {
        this.#pos = value;
        this.rays?.forEach(r => r.pos = value);
    }

    #fov;
    get fov() { return this.#fov; }
    set fov(value) {
        this.#fov = value;
        this.#buildRays();
    }

    constructor(x, y) {
        this.pos = createVector(x, y);
        this.vel = createVector(0, 0);
        this.acc = createVector(0, 0);
        this.maxSpeed = -1;
        this.mass = 20;
        this.heading = 0;
        this.fov = 60;
    }

    #buildRays() {
        let min = Math.floor(this.heading - this.#fov / 2);
        this.rays = new Array(this.fov)
            .fill(undefined)
            .map((_, i) => ++min)
            .map((a, _) => new Ray(this.pos, a, 0));
    }

    rotate(degrees) {
        this.heading = this.heading + degrees;
        let min = Math.floor(this.heading - this.#fov / 2);
        this.rays?.forEach(r => r.angle = ++min);
    }

    forwardBack(amt) {
        const f = p5.Vector.fromAngle(radians(this.heading));
        f.mult(amt);
        this.applyForce(f);
    }

    applyForce(force) {
        const f = force.copy().div(this.mass);
        this.acc.add(f);
    }

    move() {
        this.vel.add(this.acc);
        if (this.maxSpeed > 0) { this.vel.limit(this.maxSpeed); }
        this.pos.add(this.vel);
        this.vel.mult(.95);
        this.acc.mult(0);
        this.rays?.forEach(r => r.update());
    }

    castRaysToLevel(level) {
        push();
        stroke(255,0,0);
        strokeWeight(1);
        fill(0, 255, 0);
        for (const r of this.rays) {
            r.len = 0;
            let hit_wall = false;
            let step_size = level.cubeRadius;
            while (level.isInScreenBounds(r.end.x, r.end.y)) {
                r.len += step_size;
                const gpos = level.screenToLevel(r.end.x, r.end.y);
                if (level.getFromGrid(...gpos) !== 0) { // Hit wall
                    if (hit_wall === false) {
                        r.len -= level.cubeSize;
                        step_size = 1;
                        hit_wall = true;
                    }
                    else {
                        let sides = Object.values(level.getLevelPositionScreenSideRays(...gpos));
                        sides.forEach(r => r.draw());
                        sides = sides.map(s => {
                            const x = s.intersects(r);
                            return { ...x, dist: r.pos.dist(x.ip) };
                        });
                        sides
                            .filter(s => s.int === true)
                            .forEach(s => ellipse(s.ip.x, s.ip.y, 4, 4))
                        sides.sort((a, b) => a.dist - b.dist);
                        const closest = sides.find(s => s.int === true);
                        if (closest) r.len = closest.dist;
                        break;
                    }                        
                }
            }
        }
        pop();
    }

    draw() {
        push();

        stroke(0, 150, 50);
        strokeWeight(1);
        this.rays.forEach(r => r.draw());

        fill(255, 0, 0);
        noStroke();
        rect(this.pos.x, this.pos.y, 4, 4);

        stroke(255, 50, 0);
        strokeWeight(4);
        new Ray(this.pos, this.heading, 20).draw();

        pop();
    }
}

class GameLevel {
    _level;
    _gridWidth;
    _gridHeight;

    #cubeSize;
    #cubeRadius;

    get cubeSize() { return this.#cubeSize; }
    get cubeRadius() { return this.#cubeRadius; }
    set cubeSize(value) {
        this.#cubeSize = value;
        this.#cubeRadius = value / 2;
    }

    constructor(level, width, height, options = {}) {
        this._level = level;
        this._gridWidth = width;
        this._gridHeight = height;

        this.#cubeSize = options.cubeSize;
        if (this.cubeSize === undefined) {
            const minDim = Math.min(windowWidth, windowHeight);
            this.cubeSize = minDim / Math.max(this._gridWidth, this._gridHeight);
            this.cubeSize = Math.floor(this.cubeSize);
        }

        this.borderSize = options.borderSize ?? 2;

        const bounds = this.getLevelScreenBounds();
        this.horizontalRays = new Array(this._gridHeight + 1)
            .fill(undefined)
            .map((_, i) => Ray.fromVectors(createVector(bounds.left, i * this.cubeSize), createVector(bounds.right, i * this.cubeSize)));
        this.horizontalRays = this.horizontalRays.reduce((a, r) => { a[r.pos.y] = r; return a; }, {});
        this.verticalRays = new Array(this._gridWidth + 1)
            .fill(undefined)
            .map((_, i) => Ray.fromVectors(createVector(i * this.cubeSize, bounds.top), createVector(i * this.cubeSize, bounds.bottom)));
        this.verticalRays = this.verticalRays.reduce((a, r) => { a[r.pos.x] = r; return a; }, {});
    }

    getFromGrid(x, y) {
        if (y < 0 || y > this._gridHeight) return undefined;
        if (x < 0 || x > this._gridWidth) return undefined;
        return this._level[Math.floor(y) * this._gridHeight + Math.floor(x)];
    }

    levelToScreen(x, y) {
        return createVector(
            x * this.cubeSize + this.cubeRadius,
            y * this.cubeSize + this.cubeRadius,
        );
    }
    levelCenterToScreen(x, y) {
        return createVector(
            Math.floor(x) * this.cubeSize + this.cubeRadius,
            Math.floor(y) * this.cubeSize + this.cubeRadius,
        );
    }
    screenToLevelGrid(x, y) {
        return this.screenToLevel(x, y).map(v => Math.floor(v));
    }
    screenToLevel(x, y) {
        return [x / this.cubeSize, y / this.cubeSize];
    }

    getLevelPositionScreenBounds(x, y) {
        const center = this.levelCenterToScreen(x, y);
        return {
            topLeft: createVector(center.x - this.cubeRadius, center.y - this.cubeRadius),
            topRight: createVector(center.x + this.cubeRadius, center.y - this.cubeRadius),
            bottomLeft: createVector(center.x - this.cubeRadius, center.y + this.cubeRadius),
            bottomRight: createVector(center.x + this.cubeRadius, center.y + this.cubeRadius),
        }
    }
    getLevelScreenBounds() {
        return {
            top: 0,
            left: 0,
            bottom: this.cubeSize * this._gridWidth,
            right: this.cubeSize * this._gridHeight,
        };
    }
    getLevelPositionScreenSideRays(x, y) {
        const bounds = this.getLevelPositionScreenBounds(x, y);
        return {
            top: Ray.fromVectors(bounds.topLeft, bounds.topRight),
            bottom: Ray.fromVectors(bounds.bottomLeft, bounds.bottomRight),
            left: Ray.fromVectors(bounds.topLeft, bounds.bottomLeft),
            right: Ray.fromVectors(bounds.topRight, bounds.bottomRight),
        };
    }

    isInScreenBounds(x, y) {
        const bounds = this.getLevelScreenBounds();
        return (bounds.left <= x && x <= bounds.right)
            && (bounds.top <= y && y <= bounds.bottom);
    }

    draw() {
        push();

        noStroke();
        const drawRadius = this.cubeRadius - this.borderSize;

        for (let gy = 0; gy < this._gridHeight; ++gy) {
            for (let gx = 0; gx < this._gridWidth; ++gx) {
                const v = this.getFromGrid(gx, gy);
                const { x, y } = this.levelToScreen(gx, gy);

                v === 1
                    ? fill(255)
                    : fill(0);

                rect(x, y, drawRadius, drawRadius);

                //fill(0, 255, 0);
                //ellipse(sx, sy, 10);
            }
        }

        pop();
    }
}

// =================================================

const kb = new KeyBoardController(self);
let p, level;

function setup() {
    frameRate(60);
    createCanvas(windowWidth, windowHeight, P2D);
    rectMode(RADIUS);
    angleMode(DEGREES);

    p = new Player(width / 2, height / 2);

    const l = [
        1, 1, 1, 1, 1, 1, 1, 1,
        1, 0, 0, 0, 0, 1, 0, 1,
        1, 0, 0, 0, 0, 0, 0, 1,
        1, 0, 1, 1, 0, 0, 0, 1,
        1, 0, 1, 0, 0, 1, 0, 1,
        1, 0, 1, 0, 1, 1, 0, 1,
        1, 0, 0, 0, 0, 1, 0, 1,
        1, 1, 1, 1, 1, 1, 1, 1,
    ];
    level = new GameLevel(l, 8, 8, {
        borderSize: 1
    });

    p.pos = level.levelToScreen(1, 1);
    p.fov = 1;
}

function draw() {
    background(20);

    if (kb.isAnyPressed()) {
        // move player
        if (kb.isAnyPressed('A', 'ArrowLeft'))
            p.rotate(-2);
        if (kb.isAnyPressed('D', 'ArrowRight'))
            p.rotate(2);
        if (kb.isAnyPressed('W', 'ArrowUp'))
            p.forwardBack(3);
        if (kb.isAnyPressed('S', 'ArrowDown'))
            p.forwardBack(-3);
    }

    p.move();    
    level.draw();
    p.castRaysToLevel(level);
    p.draw();
}