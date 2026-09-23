# ADR 0006: Sample a video into frames, and lower the rate, not the length

## Context

People asked to make an animated sticker out of a video. The tool only took
pictures, one file per frame, which meant exporting frames from a video with
another program first.

A video does not fit a sticker. WhatsApp plays an animated sticker as a silent
loop of at most 60 pictures, 10 seconds and 500KB in total. A 20 second reel at
30 pictures a second is 600 pictures. So something has to choose a piece of the
video, and then choose how many pictures to take out of that piece.

The browser gives no frame list. A `<video>` element plays and seeks; it does not
hand back "the frames". The only way to read a picture is to move the video to a
moment, wait, and draw the element onto a canvas. Each of those seeks costs real
time, so the number of them is the cost of the whole feature.

Two answers were open when the frame budget runs out. Either cut the clip short
and keep the rate, or keep the clip and take fewer pictures out of it.

## Decision

Take a clip, sample it, and play it at real speed.

- The person chooses a start, a length and a rate. The default is the first three
  seconds at 12 pictures a second, which is 36 frames.
- Each frame stays on screen for the gap between the moments it came from, so the
  sticker moves at the speed of the video.
- When the rate asks for more than 60 frames, **the length wins**: the clip is
  sampled wider and the movement gets a little choppier. A person who chose three
  seconds gets three seconds.
- `video.js` decides every moment to grab and holds no browser code.
  `render.js` seeks and draws. This follows the split the rest of the project
  uses, and it is what lets the arithmetic be tested with no video at all.
- Frames from a video arrive with no cut-out, and framed with "fill". Searching
  for the background on 36 frames would be slow, and would cut each frame a
  little differently, which flickers.

The output is the animated WebP the tool already writes (ADR 0001). WhatsApp does
not take a GIF, so "animated GIF" in a request means "animated sticker" here.

## Consequences

- A video becomes a sticker in one step, inside the tool, on the device.
- The picture the person scrubs to is the picture they get: the panel shows the
  very `<video>` element the frames are grabbed from.
- Reading 36 frames takes a few seconds, one seek at a time, so the panel counts
  them out loud.
- Many frames share 500KB, so a long clip comes out at a lower quality. The panel
  warns above 40 frames instead of letting the export find out.
- The cut-out tools still work on a video frame, one frame at a time. Cutting the
  background out of a whole clip is not something this decision gives.
