from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "road-to-austin-presenter-guide.pdf"
PUBLIC = ROOT / "public" / "road-to-austin-presenter-guide.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

CREAM = HexColor("#F3EFE5")
INK = HexColor("#10141A")
MUTED = HexColor("#59616D")
RED = HexColor("#E33B2E")
BLUE = HexColor("#174FC4")
YELLOW = HexColor("#F1C34B")
WHITE = HexColor("#FFFFFF")
LINE = HexColor("#D1CBC0")

PAGE_W, PAGE_H = letter
MARGIN_X = 0.72 * inch
MARGIN_TOP = 0.62 * inch
MARGIN_BOTTOM = 0.62 * inch


class GuideTemplate(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(
            filename,
            pagesize=letter,
            leftMargin=MARGIN_X,
            rightMargin=MARGIN_X,
            topMargin=MARGIN_TOP,
            bottomMargin=MARGIN_BOTTOM,
            title="Road to Austin - Instructor Demo Script",
            author="Road to Austin project",
            subject="3-5 minute presenter guide",
        )
        frame = Frame(
            MARGIN_X,
            MARGIN_BOTTOM,
            PAGE_W - 2 * MARGIN_X,
            PAGE_H - MARGIN_TOP - MARGIN_BOTTOM,
            id="main",
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
        )
        self.addPageTemplates([PageTemplate(id="guide", frames=frame, onPage=draw_page)])


def draw_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(CREAM)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    canvas.setFillColor(RED)
    canvas.rect(0, PAGE_H - 0.13 * inch, PAGE_W, 0.13 * inch, stroke=0, fill=1)
    canvas.setStrokeColor(LINE)
    canvas.line(MARGIN_X, 0.46 * inch, PAGE_W - MARGIN_X, 0.46 * inch)
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN_X, 0.28 * inch, "ROAD TO AUSTIN  /  PRESENTER GUIDE")
    canvas.drawRightString(PAGE_W - MARGIN_X, 0.28 * inch, f"{doc.page}")
    canvas.restoreState()


styles = getSampleStyleSheet()
title = ParagraphStyle(
    "Title",
    parent=styles["Title"],
    fontName="Helvetica-Bold",
    fontSize=35,
    leading=34,
    textColor=INK,
    alignment=TA_LEFT,
    spaceAfter=7,
)
subtitle = ParagraphStyle(
    "Subtitle",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=12,
    leading=17,
    textColor=MUTED,
    spaceAfter=12,
)
kicker = ParagraphStyle(
    "Kicker",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=8,
    leading=10,
    textColor=RED,
    spaceAfter=7,
)
heading = ParagraphStyle(
    "Heading",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=16,
    leading=18,
    textColor=INK,
    spaceBefore=8,
    spaceAfter=5,
    keepWithNext=True,
)
cue = ParagraphStyle(
    "Cue",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=8,
    leading=11,
    textColor=BLUE,
    spaceAfter=4,
    borderColor=BLUE,
    borderWidth=0.7,
    borderPadding=(4, 7, 4, 7),
    backColor=WHITE,
)
body = ParagraphStyle(
    "Body",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=9.6,
    leading=13.2,
    textColor=INK,
    spaceAfter=6,
)
note = ParagraphStyle(
    "Note",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8.4,
    leading=11.5,
    textColor=INK,
    borderColor=YELLOW,
    borderWidth=0,
    borderLeft=5,
    borderPadding=(6, 10, 6, 10),
    backColor=WHITE,
    spaceAfter=10,
)
time_style = ParagraphStyle(
    "Time",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=9,
    leading=11,
    textColor=WHITE,
    backColor=BLUE,
    borderPadding=(5, 8, 5, 8),
    spaceAfter=14,
)


def block(cue_text, heading_text, paragraphs):
    return KeepTogether(
        [
            Paragraph(cue_text, cue),
            Paragraph(heading_text, heading),
            *[Paragraph(p, body) for p in paragraphs],
            Spacer(1, 4),
        ]
    )


story = [
    Paragraph("INSTRUCTOR DEMO  /  3-5 MINUTES", kicker),
    Paragraph("ROAD TO<br/><font color='#E33B2E'>AUSTIN</font>", title),
    Paragraph(
        "A presenter script for walking through the F1 2026 family companion in the same order a first-time fan experiences it.",
        subtitle,
    ),
    Paragraph("Target time: about 4 minutes &nbsp;&nbsp; | &nbsp;&nbsp; Audience: course instructor", time_style),
    Paragraph(
        "<b>Before you begin</b><br/>Open the public site on the homepage. Keep this guide on a second screen or print it. Read the regular text aloud; the blue boxes are action cues and are not spoken.",
        note,
    ),
    block(
        "START ON THE HOMEPAGE - PAUSE BEFORE SCROLLING",
        "1. Begin with a destination",
        [
            "This is <b>Road to Austin</b>, a family companion for people who are new to Formula 1 and will attend the 2026 United States Grand Prix.",
            "Instead of opening with a dense standings table, the app begins with the event that matters personally to the users. The countdown, COTA track outline, race date and remaining races establish where we are going and how the season builds toward it.",
            "The visual direction combines the energy of a motorsport broadcast with the friendliness of an event poster. It supports light and dark modes, adapts to phone screens and uses plain-language explanations throughout.",
        ],
    ),
    block(
        "POINT TO THE SEASON SNAPSHOT BELOW THE HERO",
        "2. Give the season context",
        [
            "This strip quickly identifies the championship leader, the leading team and the closest significant competition.",
            "These facts are calculated from the supplied results rather than stored as a second set of standings that could become inconsistent.",
        ],
    ),
    block(
        "SELECT \"ROAD TO AUSTIN\" AND SHOW THE LATEST RECAP",
        "3. Create a post-race family ritual",
        [
            "The main recurring experience is the family check-in after each race weekend.",
            "The result is presented as a story: a factual headline, short recap, podium, notable performances and the moments that shaped the race. The race selector also lets the family revisit earlier weekends and follow how the season developed.",
        ],
    ),
    PageBreak(),
    Paragraph("THE RECURRING CHECK-IN", kicker),
    Paragraph("TURN RESULTS INTO<br/><font color='#174FC4'>A STORY</font>", title),
    block(
        "SCROLL TO \"RACE SIGNALS\"",
        "4. Explain why each number matters",
        [
            "A new fan sees not only who recorded the fastest lap or how many safety cars occurred, but why those details affected the race.",
            "Where the source data does not contain a fact, the app says it is unavailable. It never invents missing qualifying, tire, pit-stop or starting-grid information.",
        ],
    ),
    block(
        "SCROLL TO \"THE CLOSEST FIGHTS\"",
        "5. Stay neutral while creating tension",
        [
            "The companion does not tell the family whom to support. Instead, it identifies close competitions among both drivers and teams.",
            "These battles are calculated from confirmed results. Small points gaps help newcomers see which positions could change at the next race.",
        ],
    ),
    block(
        "SHOW THE JSON UPDATE AREA",
        "6. Make the experience last all season",
        [
            "After each race weekend, I can drag in an updated version of the same JSON file. Recaps, standings, championship gaps and close battles refresh immediately.",
            "The updated data is remembered on that device, so a page refresh does not erase it.",
        ],
    ),
    block(
        "SELECT \"F1 IN 90 SEC\"",
        "7. Teach only what the audience needs",
        [
            "The next section explains the sequence of practice, qualifying and the Grand Prix, followed by three foundational numbers: 22 drivers, 11 teams and 25 points for a win.",
            "Terms such as DRS, undercut, constructor and safety car appear in expandable explanations. The page stays approachable while detail remains available on demand.",
        ],
    ),
    block(
        "SELECT \"MEET THE GRID\"",
        "8. Introduce the people after the rules",
        [
            "The grid is ordered by current championship points. Team colors make cars and teammates easier to recognize, while recent points provide a simple view of form.",
            "The presentation remains factual and neutral, using nationality, team, championship history, debut year and confirmed performance data.",
        ],
    ),
    PageBreak(),
    Paragraph("THE DESTINATION", kicker),
    Paragraph("ARRIVE IN AUSTIN<br/><font color='#E33B2E'>READY</font>", title),
    block(
        "SELECT \"AUSTIN GUIDE\"",
        "9. Narrow the season to the family trip",
        [
            "This section introduces Circuit of the Americas and three accessible things to watch: the climb to Turn 1, the fast direction changes and the compromises teams make when setting up a car.",
            "Confirmed Austin session times are not yet in the dataset, so the app clearly says they will be added only when reliable information is available.",
        ],
    ),
    block(
        "SHOW \"YOUR AUSTIN PICKS\"",
        "10. Add a personal stake without adding bias",
        [
            "Family members can predict the winner, a surprise result and the leading team. Their selections are saved locally without accounts or personal-data collection.",
            "This creates a social and emotional stake while the companion itself remains neutral.",
        ],
    ),
    block(
        "SELECT \"RACE DAY\"",
        "11. Finish with a one-handed cheat sheet",
        [
            "The race-day view tells a newcomer what to watch at five moments: the start, opening laps, pit window, a safety-car period and the final laps. Their Austin predictions appear at the bottom.",
            "The goal is not to imitate live timing. It is to help someone at the circuit understand why each phase of the race is exciting.",
        ],
    ),
    block(
        "RETURN TO THE TOP OR LEAVE THE RACE-DAY CARD VISIBLE",
        "Close with the design idea",
        [
            "Road to Austin transforms a detailed season dataset into a progressive learning journey: anticipation, the latest story, essential rules, the people, the destination and finally the live race experience.",
            "It gives the family a reason to return after every Grand Prix while helping them arrive in Austin informed, involved and ready to enjoy the race.",
        ],
    ),
    Paragraph(
        "<b>Optional closing line:</b> The design principle throughout is progressive disclosure: show the newcomer what matters now, then reveal more detail only when it becomes useful.",
        note,
    ),
]

doc = GuideTemplate(str(OUT))
doc.build(story)
PUBLIC.write_bytes(OUT.read_bytes())
print(OUT)
print(PUBLIC)
