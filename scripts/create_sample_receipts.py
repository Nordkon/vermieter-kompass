from pathlib import Path
from shutil import copy2

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"
PUBLIC = ROOT / "public" / "sample-receipts"

RECEIPTS = [
    ("grundsteuer_2026_2027.pdf", "Stadt Essen - Grundbesitzabgaben", "GS-2026-0714", "Grundsteuer 2026/2027", "01.08.2026 - 31.07.2027", "720,00 EUR", "Umlagefaehige Objektkosten"),
    ("gebaeudeversicherung_2026_2027.pdf", "Ruhr-Assekuranz Muster AG", "VS-88127", "Gebaeudeversicherung", "01.08.2026 - 31.07.2027", "480,00 EUR", "Umlagefaehige Objektkosten"),
    ("wasser_abwasser_2026_2027.pdf", "Stadtwerke Essen Muster GmbH", "WA-45127-12", "Wasser und Abwasser", "01.08.2026 - 31.07.2027", "960,00 EUR", "Umlagefaehige Objektkosten"),
    ("heizungswartung_2027.pdf", "ThermoCheck Ruhr GmbH", "HW-2027-042", "Heizungswartung", "01.08.2026 - 31.07.2027", "240,00 EUR", "Im Musterfall umlagefaehig"),
    ("rohrreinigung_wc_2027.pdf", "Rohrfrei Essen GmbH", "RR-2027-411", "WC-Verstopfung und Rohrreinigung", "11.04.2027", "165,00 EUR", "Nicht umlagefaehige Eigentuemerkosten"),
]


def create_receipt(target: Path, supplier: str, invoice: str, subject: str, period: str, amount: str, note: str) -> None:
    page_width, page_height = A4
    pdf = canvas.Canvas(str(target), pagesize=A4, pageCompression=1)
    pdf.setTitle(subject)
    pdf.setAuthor("Vermieter Kompass - gepruefter Musterbestand")

    pdf.setFillColor(HexColor("#16493f"))
    pdf.rect(0, page_height - 118, page_width, 118, fill=1, stroke=0)
    pdf.setFillColor(HexColor("#ffffff"))
    pdf.setFont("Helvetica-Bold", 19)
    pdf.drawString(42, page_height - 55, "VERMIETER KOMPASS")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(42, page_height - 77, "Gepruefter Musterbeleg - keine echte Rechnung")

    pdf.setFillColor(HexColor("#102f2a"))
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawString(42, page_height - 164, subject)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(42, page_height - 190, supplier)
    pdf.drawString(42, page_height - 207, f"Belegnummer: {invoice}")

    rows = [
        ("Mietobjekt", "Haus Abendstern, Sternweg 12, 45127 Essen"),
        ("Leistungszeitraum", period),
        ("Zuordnung", note),
    ]
    y = page_height - 258
    for label, value in rows:
        pdf.setFillColor(HexColor("#697b75"))
        pdf.setFont("Helvetica", 9)
        pdf.drawString(42, y, label.upper())
        pdf.setFillColor(HexColor("#102f2a"))
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(180, y, value)
        pdf.setStrokeColor(HexColor("#dfe5e1"))
        pdf.line(42, y - 10, page_width - 42, y - 10)
        y -= 45

    pdf.setFillColor(HexColor("#f2f6f3"))
    pdf.roundRect(42, y - 70, page_width - 84, 75, 8, fill=1, stroke=0)
    pdf.setFillColor(HexColor("#51635d"))
    pdf.setFont("Helvetica", 10)
    pdf.drawString(60, y - 25, "GESAMTBETRAG")
    pdf.setFillColor(HexColor("#16493f"))
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawRightString(page_width - 60, y - 31, amount)

    pdf.setFillColor(HexColor("#697b75"))
    pdf.setFont("Helvetica", 8)
    pdf.drawString(42, 52, "Fiktiver Beleg fuer die Terra-End-to-End-Abnahme. Nicht zahlbar.")
    pdf.drawRightString(page_width - 42, 52, "Seite 1 von 1")
    pdf.save()


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for filename, supplier, invoice, subject, period, amount, note in RECEIPTS:
        target = OUTPUT / filename
        create_receipt(target, supplier, invoice, subject, period, amount, note)
        copy2(target, PUBLIC / filename)
        if target.stat().st_size >= 50 * 1024:
            raise RuntimeError(f"{filename} ist groesser als 50 KB")
        print(f"{filename}: {target.stat().st_size} bytes")


if __name__ == "__main__":
    main()
