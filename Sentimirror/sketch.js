let video;
let poseNet, handpose;
let poses = [];
let hands = [];

let spacing = 15;
let numLines = 20;
let cols;
let t = 0;

let trackers = [];
let lineOffsets = [];

let souvenirTaken = false;
let showSouvenirText = false;
let souvenirTimerStarted = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO);
  video.size(320, 240);
  video.hide();

  colorMode(HSB, 360, 100, 100, 1);
  cols = floor(width / spacing);
  lineOffsets = Array.from({ length: numLines }, () => random(-1, 1));

  poseNet = ml5.poseNet(video, () => console.log("✅ PoseNet loaded"));
  poseNet.on("pose", (results) => (poses = results));

  handpose = ml5.handpose(video, () => console.log("✅ HandPose loaded"));
  handpose.on("predict", (results) => (hands = results));

  strokeWeight(2);
  noFill();
  textFont("owners"); // Adobe font
}

function draw() {
  background(0, 0, 100);
  t += 0.03;
  updateTrackers();

  // Webcam mirror
  blendMode(BLEND);
  push();
  translate(width, 0);
  scale(-1, 1);
  tint(255, 60);
  image(video, 0, 0, width, height);
  pop();

  blendMode(ADD);

  for (let l = 0; l < numLines; l++) {
    let yBase = height / 2 + (l - numLines / 2) * 40;
    let dir = lineOffsets[l];

    for (let g = 3; g >= 1; g--) {
      strokeWeight((2 + (l % 2)) * g);
      stroke(map(l, 0, numLines, 200, 240), 80, 100, 0.07 * g);

      beginShape();
      for (let x = 0; x < width; x += spacing) {
        let interaction = 0;
        for (let pt of trackers) {
          let d = dist(x, yBase, pt.x, pt.y);
          if (d < 180) {
            interaction += map(d, 0, 180, -60 * (pt.weight || 1), 0);
          }
        }

        let y =
          yBase +
          sin(x * 0.015 + t * 2 + l) * 20 +
          cos(t * 2 + x * 0.005 + l) * dir * 20 +
          interaction;

        curveVertex(x, y);
      }
      endShape();
    }
  }

  blendMode(BLEND);

  // Trigger souvenir logic
  if (!souvenirTaken && frameCount > 900 && !souvenirTimerStarted) {
    showSouvenirText = true;
    souvenirTimerStarted = true;

    setTimeout(() => {
      showSouvenirText = false; // Hide text BEFORE screenshot

      let dataURL = canvas.toDataURL("image/png");

      const qrContainer = document.getElementById("qr-container");
      qrContainer.innerHTML = `
        <a href="${dataURL}" download="sentimental-souvenir.png" style="text-align:center; display:block;">
          <img src="${dataURL}" style="width: 128px; border-radius: 8px;"/>
          <p style="margin-top: 6px; font-family: 'owners'; color: black;">Tap to download your souvenir</p>
        </a>`;
      qrContainer.style.display = "block";

      souvenirTaken = true;
    }, 2500);
  }

  if (showSouvenirText) {
    push();
    textFont("owners");
    textAlign(CENTER, CENTER);
    textSize(32);
    fill(255); // White text

    drawingContext.shadowBlur = 10;
    drawingContext.shadowColor = "rgba(255, 255, 255, 0.3)";

    text("Pause for a sentimental souvenir...", width / 2, height / 2);
    pop();
  }
}

function updateTrackers() {
  trackers = [];
  if (poses.length > 0) {
    let keypoints = poses[0].pose.keypoints;
    let names = ["nose", "leftEye", "rightEye", "leftEar", "rightEar"];

    for (let name of names) {
      const kp = keypoints.find((k) => k.part === name);
      if (kp && kp.score > 0.5) {
        let tx = map(kp.position.x, 0, video.width, width, 0);
        let ty = map(kp.position.y, 0, video.height, 0, height);
        trackers.push({ x: tx, y: ty, weight: 1 });
      }
    }
  }

  for (let hand of hands) {
    let wrist = hand.landmarks[0];
    let wristX = map(wrist[0], 0, video.width, width, 0);
    let isLeftHand = wristX > width / 2;

    for (let pt of hand.landmarks) {
      let x = map(pt[0], 0, video.width, width, 0);
      let y = map(pt[1], 0, video.height, 0, height);
      trackers.push({ x, y, weight: isLeftHand ? 1.8 : 1 });
    }
  }
}
