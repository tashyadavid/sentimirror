// === SentiMirror Combined Script ===

// DOM Elements
const enterScreen = document.getElementById("enter-screen");
const status = document.getElementById("status");
const mainContent = document.getElementById("main-content");
const video = document.getElementById("mirror");
const questionDisplay = document.getElementById("question-display");
const outputDiv = document.getElementById("output");

// Question list
let listOfQuestions = [
  "What kind of song is playing in the background of your thoughts?",
  "If your feelings were weather, what forecast would you give?",
  "What memory has visited you most often lately?",
  "Is there a corner of your mind you’ve been avoiding?",
  "Are you drifting, rooted, or reaching?",
  "Is there a word you’ve been afraid to say out loud lately?",
  "Is your breath heavy or light today?",
  "What does comfort smell like to you?",
  "If you could press pause on one feeling, which would it be?",
  "If your heart wrote a letter today, what would the first line say?",
];

function pickQuestion(list) {
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

function speakText(text, lang = "en-GB") {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.onend = resolve;
    speechSynthesis.speak(utterance);
  });
}

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = "en-US";
recognition.interimResults = false;
recognition.maxAlternatives = 1;

function startInitialListening() {
  status.textContent = "Say 'yes' or 'ready' to start";
  recognition.start();
}

recognition.onstart = () => {
  status.textContent = "Listening...";
};

recognition.onerror = (event) => {
  status.textContent = "Error: " + event.error;
};

recognition.onresult = async (event) => {
  const transcript = event.results[0][0].transcript.toLowerCase();
  console.log("Transcript:", transcript);

  if (!mainContent.classList.contains("visible")) {
    if (transcript.includes("yes") || transcript.includes("ready")) {
      status.textContent = "Welcome! Opening mirror...";
      recognition.stop();
      await showMirrorAndAskQuestion();
    } else {
      status.textContent = 'Say "yes" or "ready" to enter';
      recognition.stop();
    }
  } else {
    outputDiv.textContent = transcript;
  }
};

recognition.onend = () => {
  if (!mainContent.classList.contains("visible")) {
    recognition.start();
  }
};

async function showMirrorAndAskQuestion() {
  enterScreen.style.display = "none";
  mainContent.style.display = "flex";
  mainContent.classList.add("visible");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
  } catch (err) {
    alert("Camera access denied or not available.");
    console.error(err);
    return;
  }

  startVisualSketch();

  const question = pickQuestion(listOfQuestions);
  questionDisplay.textContent = question;
  await speakText(question);
  startAnswerListening();
}

function startAnswerListening() {
  status.textContent = "Recording...";
  recognition.stop();

  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onresult = async (event) => {
    const answer = event.results[0][0].transcript;
    outputDiv.textContent = answer;
    status.textContent = "Recording stopped.";
    console.log("Captured answer:", answer);

    try {
      const analyze = (
        await import("https://cdn.skypack.dev/sentiment-analysis")
      ).default;
      const result = analyze(answer);
      console.log("Sentiment Analysis:", result);
    } catch (err) {
      console.error("Failed to load Sentiment module:", err);
    }
  };

  recognition.onend = () => {
    status.textContent = "Finished listening for answer.";
  };

  recognition.onerror = (event) => {
    status.textContent = "Error: " + event.error;
    console.error(event.error);
  };

  recognition.start();
}

function startVisualSketch() {
  new p5((p) => {
    let spacing = 15;
    let numLines = 20;
    let cols;
    let t = 0;
    let trackers = [];
    let lineOffsets = [];
    let poseNet, handpose;
    let poses = [];
    let hands = [];
    let souvenirTaken = false;
    let showSouvenirText = false;
    let souvenirTimerStarted = false;

    p.setup = () => {
      p.createCanvas(p.windowWidth, p.windowHeight);
      cols = p.floor(p.width / spacing);
      lineOffsets = Array.from({ length: numLines }, () => p.random(-1, 1));
      p.colorMode(p.HSB, 360, 100, 100, 1);
      p.strokeWeight(2);
      p.noFill();
      p.textFont("owners");

      poseNet = ml5.poseNet(video, () => console.log("PoseNet loaded"));
      poseNet.on("pose", (results) => (poses = results));

      handpose = ml5.handpose(video, () => console.log("HandPose loaded"));
      handpose.on("predict", (results) => (hands = results));
    };

    p.windowResized = () => {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
    };

    p.draw = () => {
      p.background(0, 0, 100);
      t += 0.03;

      updateTrackers();

      p.blendMode(p.BLEND);
      p.push();
      p.translate(p.width, 0);
      p.scale(-1, 1);
      p.image(video, 0, 0, p.width, p.height);
      p.pop();

      p.blendMode(p.ADD);

      for (let l = 0; l < numLines; l++) {
        let yBase = p.height / 2 + (l - numLines / 2) * 40;
        let dir = lineOffsets[l];

        for (let g = 3; g >= 1; g--) {
          p.strokeWeight((2 + (l % 2)) * g);
          p.stroke(p.map(l, 0, numLines, 200, 240), 80, 100, 0.07 * g);

          p.beginShape();
          for (let x = 0; x < p.width; x += spacing) {
            let interaction = 0;
            for (let pt of trackers) {
              let d = p.dist(x, yBase, pt.x, pt.y);
              if (d < 180) {
                interaction += p.map(d, 0, 180, -60 * (pt.weight || 1), 0);
              }
            }

            let y =
              yBase +
              p.sin(x * 0.015 + t * 2 + l) * 20 +
              p.cos(t * 2 + x * 0.005 + l) * dir * 20 +
              interaction;

            p.curveVertex(x, y);
          }
          p.endShape();
        }
      }

      p.blendMode(p.BLEND);

      if (!souvenirTaken && p.frameCount > 900 && !souvenirTimerStarted) {
        showSouvenirText = true;
        souvenirTimerStarted = true;

        setTimeout(() => {
          showSouvenirText = false;
          let dataURL = p.canvas.toDataURL("image/png");

          const qrContainer = document.getElementById("qr-container");
          qrContainer.innerHTML = `
            <a href="${dataURL}" download="sentimental-souvenir.png" style="text-align:center; display:block;">
              <img src="${dataURL}" style="width: 128px; border-radius: 8px;"/>
              <p style="margin-top: 6px; font-family: 'owners'; color: black; text-decoration: none;">Tap to download your souvenir</p>
            </a>`;
          qrContainer.style.display = "block";

          souvenirTaken = true;
        }, 2500);
      }

      if (showSouvenirText) {
        p.push();
        p.textFont("owners");
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(32);
        p.fill(255);
        p.drawingContext.shadowBlur = 10;
        p.drawingContext.shadowColor = "rgba(255, 255, 255, 0.3)";
        p.text(
          "Pause for a sentimental souvenir...",
          p.width / 2,
          p.height / 2
        );
        p.pop();
      }
    };

    function updateTrackers() {
      trackers = [];
      if (poses.length > 0) {
        let keypoints = poses[0].pose.keypoints;
        let names = ["nose", "leftEye", "rightEye", "leftEar", "rightEar"];

        for (let name of names) {
          const kp = keypoints.find((k) => k.part === name);
          if (kp && kp.score > 0.5) {
            let tx = p.map(kp.position.x, 0, video.videoWidth, p.width, 0);
            let ty = p.map(kp.position.y, 0, video.videoHeight, 0, p.height);
            trackers.push({ x: tx, y: ty, weight: 1 });
          }
        }
      }

      for (let hand of hands) {
        let wrist = hand.landmarks[0];
        let wristX = p.map(wrist[0], 0, video.videoWidth, p.width, 0);
        let isLeftHand = wristX > p.width / 2;

        for (let pt of hand.landmarks) {
          let x = p.map(pt[0], 0, video.videoWidth, p.width, 0);
          let y = p.map(pt[1], 0, video.videoHeight, 0, p.height);
          trackers.push({ x, y, weight: isLeftHand ? 1.8 : 1 });
        }
      }
    }
  });
}

window.onload = () => {
  if (!SpeechRecognition) {
    alert("Speech recognition not supported in this browser.");
    return;
  }
  startInitialListening();
};
