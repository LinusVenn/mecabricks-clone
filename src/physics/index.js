/**
 * Physics-Modul – Barrel-Export (Phase G)
 *
 * Exportiert alle öffentlichen Klassen und Konstanten des Physiksystems.
 *
 * Verwendung:
 *   import { PhysicsEngineAdapter, PhysicsWorld } from './physics/index.js';
 *
 * @module physics
 */

export { PhysicsEngineAdapter }             from './PhysicsEngineAdapter.js';
export { PhysicsWorld }                     from './PhysicsWorld.js';
export { PhysicsSimulationController,
         SIM_STATE }                        from './PhysicsSimulationController.js';
export { PhysicsBodyFactory,
         PHYSICS_BODY_TYPES }               from './PhysicsBodyFactory.js';
export { ColliderFactory }                  from './ColliderFactory.js';
export { ColliderDefinitionResolver }       from './ColliderDefinitionResolver.js';
export { PhysicsMaterialManager }           from './PhysicsMaterialManager.js';
