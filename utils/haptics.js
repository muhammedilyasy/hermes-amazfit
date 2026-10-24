import { Vibrator, VIBRATOR_SCENE_SHORT_LIGHT, VIBRATOR_SCENE_SHORT_MIDDLE, VIBRATOR_SCENE_SHORT_STRONG } from '@zos/sensor'

let vibrator = null

function play(scene) {
  if (!vibrator) vibrator = new Vibrator()
  vibrator.stop()
  vibrator.setMode(scene)
  vibrator.start()
}

export function tick() {
  play(VIBRATOR_SCENE_SHORT_LIGHT)
}

export function confirm() {
  play(VIBRATOR_SCENE_SHORT_MIDDLE)
}

// Reply arrived or Hermes needs an answer.
export function strong() {
  play(VIBRATOR_SCENE_SHORT_STRONG)
}
