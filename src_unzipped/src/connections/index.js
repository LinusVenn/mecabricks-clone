/**
 * src/connections/index.js
 *
 * Barrel file – re-exports the entire public API of the connections module.
 *
 * Phase F public surface:
 *  - F.1  Connection type constants and helpers  (ConnectionTypes.js)
 *  - F.2  Connection point value objects         (ConnectionPoint.js)
 *  - F.4  Connection point manager               (ConnectionPointManager.js)
 *  - F.3  Compatibility checking                 (ConnectionCompatibility.js)
 *  - F.5  Mechanical connection management       (MechanicalConnectionManager.js)
 */

// F.1 – type constants
export {
    CONNECTION_TYPES,
    isValidConnectionType,
    CONNECTION_TYPE_LIST
} from './ConnectionTypes.js';

// F.2 – ConnectionPoint value object
export { ConnectionPoint } from './ConnectionPoint.js';

// F.4 – ConnectionPointManager
export { ConnectionPointManager } from './ConnectionPointManager.js';

// F.3 – Compatibility checker + plain-object matrix
export {
    ConnectionCompatibility,
    COMPATIBILITY_MATRIX
} from './ConnectionCompatibility.js';

// F.5 – Mechanical connections
export {
    MECHANICAL_CONNECTION_TYPES,
    MechanicalConnection,
    MechanicalConnectionManager
} from './MechanicalConnectionManager.js';
