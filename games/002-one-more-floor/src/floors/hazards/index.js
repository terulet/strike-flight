/**
 * Importing this module registers every hazard type. Adding a new hazard =
 * a new file here + one line below.
 */
import './structure.js';
import './saw.js';
import './platform.js';
import './crumble.js';
import './laser.js';
import './crusher.js';
import './fire.js';
import './walker.js';
import './doors.js';
import './boss.js';

export { entityTypes, hasEntity, createEntity } from '../registry.js';
