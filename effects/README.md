# Local Banuba Effects

Place Banuba effect folders here when you use local `effectPath`.

Example:

- `effects/my_glasses_effect/config.json`
- `effects/my_glasses_effect/...`

During Android build, Gradle copies this folder to:

- `android/app/src/main/assets/bnb-resources/effects`

Then you can set:

- `media.tryOn.arUrl = "effects/my_glasses_effect"` (or `effectPath`)

and native try-on will load it directly.
