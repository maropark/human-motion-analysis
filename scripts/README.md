# Scripts

Standalone tooling that runs outside the app.

## `train_ball_rim_detector.ipynb`

Fine-tunes a YOLOv11n object detector for on-device ball + rim detection (Phase 3). Intended to run on Google Colab with a free T4 GPU — don't try to run this locally unless you have a GPU set up.

**Prerequisites**
- Google account (for Colab)
- Roboflow account (free tier is fine) — https://roboflow.com
- A Roboflow Universe dataset with at least `ball` and `rim` (or `hoop`) classes, ideally including sideline angles

**Workflow**
1. Open the notebook in Colab: File → Upload notebook → pick the `.ipynb`.
2. Runtime → Change runtime type → T4 GPU.
3. Find a dataset on https://universe.roboflow.com. Search "basketball detection" or "basketball hoop". Grab your API key, workspace slug, project slug, version number.
4. Paste those into cell 2.
5. Run cells top to bottom. The train cell takes ~15 min.
6. Check the mAP50 output in cell 4 — aim for > 0.7 before trusting the model. If lower, pick a dataset with more images or train longer.
7. Upload one of your own free-throw frames and run cell 5 to sanity-check generalization to your setup.
8. If sanity check looks good, run cells 6–7 to export quantized TFLite and download.
9. Drop the `.tflite` into `assets/models/ball_rim.tflite` in this repo. Commit it (Git LFS is overkill for <10 MB).

**When the model is good enough**

Phase 3's acceptance criterion lives in `.noggin/TODOS.md`: the detector has to survive evaluation on **5 of your own free-throw clips** before it's allowed into the on-device pipeline. The Roboflow val mAP number is a gate, not a finish line.
