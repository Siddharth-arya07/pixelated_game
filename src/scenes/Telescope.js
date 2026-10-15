import * as THREE from 'three';

/**
 * A telescope you can sit at. `facing` = yaw the observer starts looking
 * along. standAt = where you end up when you step back.
 */
export function addTelescope(scene, x, y, z, facing, standAt) {
  const g = scene.game;
  const t = scene.place('telescope', { x, y, z, rotY: facing + Math.PI });
  const back = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing)); // behind the eyepiece
  scene.addInteractable(t, {
    prompt: 'Look through the telescope',
    range: 2.6,
    action: () =>
      g.stargazing.useTelescope({
        eye: new THREE.Vector3(x, y + 1.45, z).addScaledVector(back, 0.45),
        yaw: facing,
        standAt: standAt ?? new THREE.Vector3(x, y, z).addScaledVector(back, 1.2),
      }),
  });
  return t;
}
