# Attribution

## Dataset

Scans shown by this project come from **Teeth3DS+**, the dataset used for the MICCAI 3DTeethSeg'22 and 3DTeethLand'24 challenges (Ben-Hamadou et al.).

- Project homepage: https://crns-smartvision.github.io/teeth3ds/
- Official access repository: https://github.com/abenhamadou/3DTeethSeg22_challenge
- Mirror: https://github.com/DCBIA-OrthoLab/3DTeethSeg22_challenge
- Data download: https://osf.io/xctdy/
- Paper: https://arxiv.org/pdf/2210.06094.pdf

**License:** [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/) (Attribution, Non-Commercial, No-Derivatives).

No patient scan files are in this repository yet. When they are added, every page that shows the data must keep this credit and link back to the official dataset and challenge. This project does not accept sponsorship, ads, or any commercial revenue tied to the dataset.

Any later format conversion for browser viewing must stay lossless and technical: no changes to vertex positions, no reshaping, and no combining one patient's anatomy with another's.

## Design references

The viewer is an original implementation. These projects informed the direction. Their code was not copied.

- [human-atlas](https://github.com/ashemag/human-atlas) — browser viewer for BodyParts3D reference anatomy, using React, Three.js, and shadcn/ui.
- [OMFAtlas](https://github.com/choxos/OMFAtlas) — dental viewer on the same idealized single-skull approach, plus hand-built pathology and development content.

## Code

Application code in this repository is under the MIT License. See [LICENSE](LICENSE). That license does not apply to the Teeth3DS+ dataset.
