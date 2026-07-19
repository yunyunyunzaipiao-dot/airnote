from pathlib import Path

import pypdfium2 as pdfium


for pdf_path, output_dir in [
    (
        Path(r"D:\air-note\.codex_tmp\rollback_prd\prd.pdf"),
        Path(r"D:\air-note\.codex_tmp\rollback_prd"),
    ),
    (
        Path(r"D:\air-note\.codex_tmp\rollback_boundary\boundary.pdf"),
        Path(r"D:\air-note\.codex_tmp\rollback_boundary"),
    ),
]:
    document = pdfium.PdfDocument(pdf_path)
    for page_number, page in enumerate(document, start=1):
        page.render(scale=1.5).to_pil().save(output_dir / f"page-{page_number}.png")
