# AdReview

The submitted ad itself, with each finding drawn as a numbered highlight box right on the image, so the proof sits in place.

- `boxes` come from the text extraction step: each box's position and size in percent of the image, `n` matching that finding's number in the findings list.
- Boxes are buttons: clicking one (or tabbing to it) selects that finding. Keep the ad visible while findings open beside it.
- The box is an `ink` outline with a 2px white halo, so it shows on dark and light pictures alike. Its `highlight` fill stays very light, because the reviewer still has to judge the ad's real colors and contrast.
- Always pass a real `alt` describing the ad's main claim.
- Text-only assets (emails, SMS) use the same idea: the flagged words in a `<mark>`, numbered.
