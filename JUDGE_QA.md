# Judge Q&A

### Is this really AI?
The current hackathon prototype uses browser OCR plus an explainable, configurable risk engine. This keeps the demo transparent and lightweight. A production version can replace or augment the rule engine with a calibrated multilingual classifier trained on labeled data.

### Does it detect scams with certainty?
No. It identifies configurable risk indicators. The UI deliberately avoids claiming that a message is definitely fraudulent or legitimate.

### What happens to screenshots?
OCR is performed locally in the browser. The image is not sent to the backend. Only extracted text is analyzed; by default the full text is not stored in the database.

### Why store history in a database?
It demonstrates a complete full-stack workflow and allows a session's recent scans to persist beyond a page refresh.

### How do you reduce false positives?
The prototype exposes the signals that caused the score. In production, thresholds would be calibrated using a labeled evaluation set and measured with precision, recall, F1 and false-positive rate.

### Can it support Hindi?
The OCR uses Tesseract.js with English + Hindi language data, and the risk rules include Hindi patterns. OCR quality still depends on image quality and typography.

### Why no investment recommendations?
The product is designed as a safety and awareness assistant, not a financial adviser. It focuses on verification and safe behavior.

### How would you scale it?
Keep OCR at the edge/browser where possible, move the risk model to a versioned inference service, add caching and queues where required, use managed PostgreSQL, and add observability and automated evaluation.
