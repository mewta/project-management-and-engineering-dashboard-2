from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from pathlib import Path


ROOT = Path("/Users/mewta/Documents/project management and engineering dashboard 2")
OUT = ROOT / "output/pdf/time-and-space-complexity-python-guide.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = HexColor("#14213D")
BLUE = HexColor("#2563EB")
SKY = HexColor("#EAF2FF")
INK = HexColor("#172033")
MUTED = HexColor("#526078")
LIGHT = HexColor("#F4F7FB")
LINE = HexColor("#D7DFEA")
GREEN = HexColor("#167D5A")
AMBER = HexColor("#A05A00")
RED = HexColor("#B42318")
WHITE = colors.white

font_regular = "/System/Library/Fonts/Supplemental/Arial.ttf"
font_bold = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
font_mono = "/System/Library/Fonts/Supplemental/Courier New.ttf"
font_mono_bold = "/System/Library/Fonts/Supplemental/Courier New Bold.ttf"
pdfmetrics.registerFont(TTFont("GuideSans", font_regular))
pdfmetrics.registerFont(TTFont("GuideSans-Bold", font_bold))
pdfmetrics.registerFont(TTFont("GuideMono", font_mono))
pdfmetrics.registerFont(TTFont("GuideMono-Bold", font_mono_bold))


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        page_count = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(page_count)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        if self._pageNumber == 1:
            return
        self.saveState()
        self.setStrokeColor(LINE)
        self.line(18 * mm, 14 * mm, 192 * mm, 14 * mm)
        self.setFont("GuideSans", 8)
        self.setFillColor(MUTED)
        self.drawString(18 * mm, 9 * mm, "Time & Space Complexity in Python")
        self.drawRightString(
            192 * mm, 9 * mm, f"Page {self._pageNumber} of {page_count}"
        )
        self.restoreState()


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        "TitleX",
        fontName="GuideSans-Bold",
        fontSize=28,
        leading=33,
        textColor=WHITE,
        alignment=TA_LEFT,
        spaceAfter=10,
    )
)
styles.add(
    ParagraphStyle(
        "SubtitleX",
        fontName="GuideSans",
        fontSize=13,
        leading=19,
        textColor=HexColor("#DCE8FF"),
        spaceAfter=10,
    )
)
styles.add(
    ParagraphStyle(
        "H1X",
        fontName="GuideSans-Bold",
        fontSize=20,
        leading=24,
        textColor=NAVY,
        spaceBefore=2,
        spaceAfter=10,
    )
)
styles.add(
    ParagraphStyle(
        "H2X",
        fontName="GuideSans-Bold",
        fontSize=14,
        leading=18,
        textColor=BLUE,
        spaceBefore=10,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        "H3X",
        fontName="GuideSans-Bold",
        fontSize=11.5,
        leading=15,
        textColor=INK,
        spaceBefore=7,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        "BodyX",
        fontName="GuideSans",
        fontSize=10,
        leading=14.3,
        textColor=INK,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        "SmallX",
        fontName="GuideSans",
        fontSize=8.6,
        leading=12,
        textColor=MUTED,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        "CalloutX",
        fontName="GuideSans",
        fontSize=10,
        leading=14,
        textColor=INK,
        leftIndent=8,
        rightIndent=8,
        spaceBefore=4,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        "CoverCalloutX",
        fontName="GuideSans",
        fontSize=10,
        leading=14,
        textColor=WHITE,
        leftIndent=8,
        rightIndent=8,
    )
)
styles.add(
    ParagraphStyle(
        "TOCX",
        fontName="GuideSans",
        fontSize=10,
        leading=15,
        textColor=INK,
        leftIndent=4,
    )
)


def P(text, style="BodyX"):
    return Paragraph(text, styles[style])


def section(title, number=None):
    label = f"{number}. {title}" if number else title
    return [P(label, "H1X"), Table([[""]], colWidths=[174 * mm], rowHeights=[1.4 * mm],
                                  style=[("BACKGROUND", (0, 0), (-1, -1), BLUE)]), Spacer(1, 4 * mm)]


def callout(title, body, color=SKY):
    data = [[P(title, "H3X")], [P(body, "CalloutX")]]
    return Table(
        data,
        colWidths=[174 * mm],
        style=TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), color),
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        ),
    )


def code(text):
    return Table(
        [[Preformatted(text.strip(), ParagraphStyle(
            "CodeX", fontName="GuideMono", fontSize=8.5, leading=11.5,
            textColor=HexColor("#E6EDF7"), leftIndent=2
        ))]],
        colWidths=[174 * mm],
        style=TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), HexColor("#101827")),
                ("BOX", (0, 0), (-1, -1), 0.6, HexColor("#26344D")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        ),
    )


def table(rows, widths=None, header=True, font_size=8.5):
    prepared = []
    for row in rows:
        prepared.append([
            cell if hasattr(cell, "wrap") else P(str(cell), "SmallX") for cell in row
        ])
    t = Table(prepared, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    style = [
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTNAME", (0, 0), (-1, 0), "GuideSans-Bold"),
        ]
        for i, value in enumerate(rows[0]):
            prepared[0][i] = Paragraph(
                str(value),
                ParagraphStyle("TH", fontName="GuideSans-Bold", fontSize=font_size,
                               leading=11, textColor=WHITE),
            )
    for r in range(1 if header else 0, len(rows)):
        if r % 2 == 0:
            style.append(("BACKGROUND", (0, r), (-1, r), LIGHT))
    t.setStyle(TableStyle(style))
    return t


def bullets(items):
    return [P(f"- {item}", "BodyX") for item in items]


story = []

# Cover
cover = Table(
    [
        [Spacer(1, 22 * mm)],
        [P("TIME & SPACE<br/>COMPLEXITY", "TitleX")],
        [P("An intuition-first Python guide for confident algorithm analysis", "SubtitleX")],
        [Spacer(1, 8 * mm)],
        [Table(
            [[P("Learn to estimate growth, analyze loops and recursion, recognize patterns, and explain tradeoffs clearly in interviews.", "CoverCalloutX")]],
            colWidths=[152 * mm],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), HexColor("#22375F")),
                ("BOX", (0, 0), (-1, -1), 0.8, HexColor("#6D8DC8")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ])
        )],
        [Spacer(1, 42 * mm)],
        [P("Includes worked examples, growth tables, Python-specific costs, practice sets, and an answer key.", "SubtitleX")],
        [Spacer(1, 10 * mm)],
        [Paragraph("Study Guide | 2026 Edition", ParagraphStyle(
            "CoverFoot", fontName="GuideSans-Bold", fontSize=10, textColor=HexColor("#9FB8E7")
        ))],
    ],
    colWidths=[174 * mm],
    rowHeights=None,
    style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("LEFTPADDING", (0, 0), (-1, -1), 11 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 11 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ])
)
story += [cover, PageBreak()]

# How to use / TOC
story += section("How to Use This Guide")
story += [
    P("Complexity analysis is not about counting every CPU instruction. It is about identifying what grows when the input grows. For each example, ask three questions:"),
    *bullets([
        "<b>What is n?</b> Define the input size before doing any analysis.",
        "<b>What operation repeats?</b> Find the work whose count depends on n.",
        "<b>How fast does that count grow?</b> Keep the dominant growth term.",
    ]),
    callout("Recommended learning loop", "Read one concept, cover the stated complexity, predict it yourself, then verify using the step-count explanation. Do the practice set before opening the answer key."),
    P("Contents", "H2X"),
]
toc = [
    ("1", "The meaning of Big-O, Big-Theta, and Big-Omega"),
    ("2", "Growth rates and visual intuition"),
    ("3", "A reliable analysis method"),
    ("4", "Loops and nested loops"),
    ("5", "Python operation costs"),
    ("6", "Space complexity"),
    ("7", "Recursion and recurrence patterns"),
    ("8", "Common algorithm patterns"),
    ("9", "Mistakes and interview communication"),
    ("10", "Practice problems"),
    ("11", "Answer key"),
]
story.append(table([["Section", "Topic"]] + toc, [25 * mm, 149 * mm]))
story.append(PageBreak())

# Section 1
story += section("Core Concept: What Complexity Really Means", 1)
story += [
    P("Imagine serving customers in a store. If one customer enters, the work is small. If one million enter, what changes? Complexity describes how the required time or memory grows as the input size grows."),
    P("Big-O: an upper growth bound", "H2X"),
    P("<b>Big-O</b> answers: \"At most, how quickly can the work grow?\" In interviews it is commonly used for worst-case growth. If an algorithm performs 3n + 10 operations, we call it O(n), because the linear term controls growth."),
    P("Big-Omega: a lower growth bound", "H2X"),
    P("<b>Big-Omega</b> answers: \"At least, how much work is unavoidable?\" Searching an unsorted list can finish on the first element in the best case, so that case is Omega(1)."),
    P("Big-Theta: a tight growth bound", "H2X"),
    P("<b>Big-Theta</b> means the upper and lower growth rates match. Traversing every element of a list is Theta(n): it does proportional work for every input of size n."),
    callout("Intuition", "O is a ceiling, Omega is a floor, and Theta is a close-fitting box. Saying Theta(n) is more precise than saying O(n^2), even though both upper-bound a linear algorithm."),
    P("Why constants disappear", "H2X"),
    P("Suppose A takes 5n steps and B takes 100n steps. B may be slower in practice, but both double when n doubles. Complexity groups algorithms by growth shape, not exact runtime."),
]
story.append(table([
    ["n", "5n", "100n", "n^2"],
    ["10", "50", "1,000", "100"],
    ["100", "500", "10,000", "10,000"],
    ["1,000", "5,000", "100,000", "1,000,000"],
    ["10,000", "50,000", "1,000,000", "100,000,000"],
], [30 * mm, 45 * mm, 45 * mm, 54 * mm]))
story.append(PageBreak())

# Section 2
story += section("Visual Understanding: Growth Rates", 2)
story += [
    P("The key skill is comparing shapes of growth. As n becomes large, faster-growing functions overwhelm slower ones."),
]
story.append(table([
    ["Complexity", "n=4", "n=8", "n=16", "n=32", "Typical example"],
    ["O(1)", "1", "1", "1", "1", "Index a list"],
    ["O(log n)", "2", "3", "4", "5", "Binary search"],
    ["O(n)", "4", "8", "16", "32", "Single full scan"],
    ["O(n log n)", "8", "24", "64", "160", "Efficient sorting"],
    ["O(n^2)", "16", "64", "256", "1,024", "All pairs"],
    ["O(2^n)", "16", "256", "65,536", "4.3B", "Subset recursion"],
], [28 * mm, 19 * mm, 19 * mm, 21 * mm, 24 * mm, 63 * mm]))
story += [
    P("A practical ranking", "H2X"),
    P("O(1) < O(log n) < O(n) < O(n log n) < O(n^2) < O(n^3) < O(2^n) < O(n!)"),
    callout("Doubling test", "Mentally double n. Constant work stays unchanged. Logarithmic work increases by about one step. Linear work doubles. Quadratic work quadruples. Exponential work can square.", HexColor("#EAF7F1")),
    P("What \"log n\" means", "H2X"),
    P("A logarithm appears when each step shrinks the remaining problem by a constant factor. If you repeatedly halve 1,024 items, only 10 halvings are needed because 2^10 = 1,024."),
]
story.append(table([
    ["Starting size", "Halvings until 1", "Observation"],
    ["8", "3", "2^3 = 8"],
    ["16", "4", "Doubling n adds one step"],
    ["1,024", "10", "Large input, few steps"],
    ["1,048,576", "20", "Over one million, only 20 steps"],
], [42 * mm, 50 * mm, 82 * mm]))
story.append(PageBreak())

# Section 3
story += section("A Reliable Step-by-Step Analysis Method", 3)
story += [
    P("Use this five-step process on unfamiliar code."),
    *bullets([
        "<b>1. Define n.</b> Is it list length, matrix dimension, number of nodes, or number of digits?",
        "<b>2. Mark primitive operations.</b> Assignments, comparisons, arithmetic, and indexing are usually O(1).",
        "<b>3. Count repetitions.</b> Determine how many times each block runs.",
        "<b>4. Combine blocks.</b> Sequential blocks add; nested dependent work usually multiplies or forms a sum.",
        "<b>5. Keep the dominant term.</b> n^2 + 3n + 20 becomes O(n^2).",
    ]),
    P("Worked example: find the maximum", "H2X"),
    code("""
def find_max(values):
    maximum = values[0]             # 1
    for value in values[1:]:        # n - 1 iterations
        if value > maximum:         # n - 1 comparisons
            maximum = value         # at most n - 1 assignments
    return maximum                   # 1
"""),
    P("The exact count depends on the data, but the loop runs proportional to n. The total is approximately a*n + b for constants a and b. Therefore time is <b>Theta(n)</b>. Ignoring the sliced copy for a moment, auxiliary space is O(1)."),
    callout("Python detail", "<code>values[1:]</code> creates a new list containing n-1 references, so this exact implementation uses O(n) extra space. Iterating by index or using an iterator avoids that copy.", HexColor("#FFF4E5")),
    code("""
def find_max_space_efficient(values):
    maximum = values[0]
    for index in range(1, len(values)):
        if values[index] > maximum:
            maximum = values[index]
    return maximum
"""),
    P("This version is still Theta(n) time but uses O(1) auxiliary space."),
]
story.append(PageBreak())

# Section 4
story += section("Loops and Nested Loops", 4)
story += [
    P("Single loop: usually linear", "H2X"),
    code("""
def total(values):
    result = 0
    for value in values:
        result += value
    return result
"""),
    P("The body executes n times. Each execution is O(1), so total time is O(n). The variables use O(1) extra space."),
    P("Two sequential loops: add, then simplify", "H2X"),
    code("""
for value in values:        # n
    process(value)

for value in values:        # n
    validate(value)
"""),
    P("Total work is n + n = 2n, which simplifies to O(n), not O(n^2). Loops multiply only when one runs inside another."),
    P("Independent nested loops: multiply", "H2X"),
    code("""
for i in range(n):          # n
    for j in range(n):      # n for each i
        visit(i, j)         # O(1)
"""),
    P("The inner statement executes n * n = n^2 times, so time is Theta(n^2)."),
    P("Triangular nested loops: sum", "H2X"),
    code("""
for i in range(n):
    for j in range(i):
        visit(i, j)
"""),
    P("The inner loop runs 0 + 1 + 2 + ... + (n-1) times. That total is n(n-1)/2, whose dominant term is n^2. Therefore time is Theta(n^2), even though the loop is triangular rather than square."),
]
story.append(table([
    ["n", "Inner executions", "Formula"],
    ["1", "0", "0"],
    ["2", "1", "0+1"],
    ["3", "3", "0+1+2"],
    ["4", "6", "0+1+2+3"],
    ["5", "10", "0+1+2+3+4"],
], [35 * mm, 55 * mm, 84 * mm]))
story.append(PageBreak())

story += [
    P("Dependent loop bounds: do not blindly multiply", "H2X"),
    code("""
i = 1
while i < n:
    i *= 2
"""),
    P("The values of i are 1, 2, 4, 8, ... Each step doubles i. After k steps, i = 2^k. The loop stops when 2^k >= n, so k is about log2(n). Time is O(log n)."),
    P("Nested linear and logarithmic loops", "H2X"),
    code("""
for value in values:        # n times
    size = n
    while size > 1:         # log n times
        size //= 2
"""),
    P("The logarithmic loop executes for every element: n * log n, so time is O(n log n)."),
    P("A loop that looks nested but is linear", "H2X"),
    code("""
left = 0
right = 0
while right < n:
    while left < right and should_remove(left):
        left += 1
    right += 1
"""),
    P("Although one loop is inside another, <code>left</code> and <code>right</code> each move only forward and at most n times. Across the entire algorithm, total pointer movement is at most 2n. This is O(n), the core idea behind sliding windows and two pointers."),
    callout("Mental rule", "Count total movement over the whole execution, not merely indentation depth."),
]
story.append(PageBreak())

# Section 5
story += section("Python-Specific Operation Costs", 5)
story += [
    P("Python syntax can hide work. Complexity depends on the data structure and operation."),
]
story.append(table([
    ["Operation", "Typical time", "Reason / caveat"],
    ["list[index]", "O(1)", "Direct array-style indexing"],
    ["list.append(x)", "Amortized O(1)", "Occasional resize costs O(n)"],
    ["list.pop()", "O(1)", "Removes from end"],
    ["list.pop(0) / insert(0,x)", "O(n)", "Remaining elements shift"],
    ["x in list", "O(n)", "Linear search"],
    ["x in set / dict", "Average O(1)", "Hash table; worst case can degrade"],
    ["len(container)", "O(1)", "Length is stored"],
    ["list slicing a:b", "O(k)", "Copies k references"],
    ["list concatenation a+b", "O(len(a)+len(b))", "Creates a new list"],
    ["sorted(values)", "O(n log n)", "Timsort; creates a list"],
    ["min/max/sum", "O(n)", "Must scan values"],
    ["string += piece", "Can accumulate to O(n^2)", "Strings are immutable; repeated copies"],
], [49 * mm, 39 * mm, 86 * mm]))
story += [
    P("Variation: membership tests", "H2X"),
    code("""
def contains_all_list(required, available):
    for item in required:           # r
        if item not in available:   # O(a)
            return False
    return True
"""),
    P("Time is O(r * a). If both lengths are n, it is O(n^2)."),
    code("""
def contains_all_set(required, available):
    available_set = set(available)  # O(a) time and space
    for item in required:           # r
        if item not in available_set:
            return False
    return True
"""),
    P("Expected time becomes O(a + r), with O(a) extra space. This is a classic time-space tradeoff."),
]
story.append(PageBreak())

# Section 6
story += section("Space Complexity", 6)
story += [
    P("Space complexity measures how memory usage grows with input size. Distinguish <b>input space</b> from <b>auxiliary space</b>, the extra memory created by the algorithm."),
    P("Constant auxiliary space", "H2X"),
    code("""
def reverse_in_place(values):
    left, right = 0, len(values) - 1
    while left < right:
        values[left], values[right] = values[right], values[left]
        left += 1
        right -= 1
"""),
    P("Time is O(n); auxiliary space is O(1) because only a few variables are created."),
    P("Linear auxiliary space", "H2X"),
    code("""
def doubled(values):
    result = []
    for value in values:
        result.append(value * 2)
    return result
"""),
    P("Time is O(n); the result contains n elements, so auxiliary/output space is O(n). State whether you count output space when explaining your answer."),
    P("Hidden space: slicing and recursion", "H2X"),
    code("""
def recursive_sum(values):
    if not values:
        return 0
    return values[0] + recursive_sum(values[1:])
"""),
    P("There are n recursive calls, so the call stack is O(n). Each slice copies a shrinking list: (n-1) + (n-2) + ... + 1 references, causing O(n^2) total copying time and substantial allocation. An index-based version avoids slicing but still has O(n) stack space."),
    callout("Space checklist", "Count containers you create, copied slices/strings, recursion depth, and temporary structures. Reusing the input does not automatically mean zero space; stack frames still count."),
]
story.append(PageBreak())

# Section 7
story += section("Recursion and Recurrence Patterns", 7)
story += [
    P("For recursion, analyze two dimensions: <b>how many calls exist</b> and <b>how much non-recursive work each call performs</b>. Space usually follows maximum recursion depth, not total calls."),
    P("One shrinking call: O(n)", "H2X"),
    code("""
def countdown(n):
    if n == 0:
        return
    countdown(n - 1)
"""),
    P("Recurrence: T(n) = T(n-1) + O(1). There are n calls, so time is O(n). Maximum stack depth is n, so space is O(n)."),
    P("One halving call: O(log n)", "H2X"),
    code("""
def halve(n):
    if n <= 1:
        return
    halve(n // 2)
"""),
    P("Each call halves n. The chain length is log2(n), giving O(log n) time and O(log n) stack space."),
    P("Two half-size calls: often O(n)", "H2X"),
    code("""
def process_tree(n):
    if n <= 1:
        return
    process_tree(n // 2)
    process_tree(n // 2)
"""),
    P("At level 0 there is 1 call, then 2, 4, 8, and so on. There are log n levels, but the total number of calls is about 1+2+4+...+n = O(n). Stack depth remains O(log n)."),
]
story.append(table([
    ["Pattern", "Typical recurrence", "Time", "Stack space"],
    ["Shrink by 1", "T(n)=T(n-1)+1", "O(n)", "O(n)"],
    ["Halve once", "T(n)=T(n/2)+1", "O(log n)", "O(log n)"],
    ["Two halves + linear merge", "T(n)=2T(n/2)+n", "O(n log n)", "O(log n)*"],
    ["Two halves + constant work", "T(n)=2T(n/2)+1", "O(n)", "O(log n)"],
    ["Two calls of n-1", "T(n)=2T(n-1)+1", "O(2^n)", "O(n)"],
], [42 * mm, 55 * mm, 35 * mm, 42 * mm]))
story += [P("*Merge sort also allocates O(n) temporary merge storage in common implementations.", "SmallX"), PageBreak()]

story += [
    P("Tree recursion: naive Fibonacci", "H2X"),
    code("""
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)
"""),
    P("Each call branches into more calls and recomputes the same values. The call tree grows exponentially: time is O(2^n) as a simple upper bound. The deepest path contains n calls, so stack space is O(n)."),
    P("Memoization changes the state count", "H2X"),
    code("""
from functools import cache

@cache
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)
"""),
    P("Only n+1 distinct inputs are solved. Each state does O(1) work after cached subproblems return, so time is O(n). Cache space and stack space are O(n)."),
    callout("Recursion shortcut", "Count distinct states when memoization is present. Without memoization, sketch the branching factor and depth. With divide-and-conquer, examine work per level and number of levels.", HexColor("#EAF7F1")),
    P("Merge sort intuition", "H2X"),
    P("Merge sort has log n levels because it repeatedly halves. At every level, all merge operations together touch n elements. Therefore n work per level * log n levels = O(n log n)."),
]
story.append(table([
    ["Level", "Subproblems", "Total elements processed"],
    ["0", "1 of size n", "n"],
    ["1", "2 of size n/2", "n"],
    ["2", "4 of size n/4", "n"],
    ["...", "...", "..."],
    ["log n", "n of size 1", "n"],
], [35 * mm, 66 * mm, 73 * mm]))
story.append(PageBreak())

# Section 8
story += section("Patterns to Recognize Quickly", 8)
patterns = [
    ["Code shape", "Likely complexity", "Reason"],
    ["Direct lookup / fixed work", "O(1)", "Work does not scale with n"],
    ["One complete scan", "O(n)", "Each item visited once"],
    ["Two pointers moving one direction", "O(n)", "Total movement is bounded"],
    ["Repeated halving/doubling", "O(log n)", "Problem size changes geometrically"],
    ["Sort, then scan", "O(n log n)", "Sorting dominates linear scan"],
    ["Loop + binary search", "O(n log n)", "n searches, each logarithmic"],
    ["Every pair", "O(n^2)", "Approximately n*n combinations"],
    ["Generate all subsets", "O(2^n)", "Each item has include/exclude choice"],
    ["Generate all permutations", "O(n!)", "n choices, then n-1, etc."],
]
story.append(table(patterns, [61 * mm, 39 * mm, 74 * mm]))
story += [
    P("Binary search", "H2X"),
    code("""
def binary_search(values, target):
    left, right = 0, len(values) - 1
    while left <= right:
        middle = (left + right) // 2
        if values[middle] == target:
            return middle
        if values[middle] < target:
            left = middle + 1
        else:
            right = middle - 1
    return -1
"""),
    P("Each iteration discards half the remaining search space. Time is O(log n), auxiliary space is O(1). The input must be sorted; sorting first would cost O(n log n)."),
    P("Breadth-first and depth-first graph traversal", "H2X"),
    P("With an adjacency list, BFS and DFS are O(V + E): every vertex is discovered at most once and every edge is examined a constant number of times. The visited structure and queue/stack use O(V) space."),
]
story.append(PageBreak())

# Section 9
story += section("Common Mistakes and Interview Focus", 9)
story += [
    P("Common mistakes", "H2X"),
]
mistakes = [
    ["Mistake", "Correction"],
    ["\"Nested loops always mean O(n^2).\"", "Inspect bounds and total pointer movement. It may be O(n log n), O(n), or another sum."],
    ["\"Two loops mean O(n^2).\"", "Sequential loops add: O(n)+O(n)=O(n). Nested independent loops multiply."],
    ["\"Hash lookup is always O(1).\"", "Say average/expected O(1); acknowledge collisions and worst-case behavior when relevant."],
    ["\"Recursion is exponential.\"", "Recursion is a control structure. One recursive call can be linear or logarithmic; branching may be exponential."],
    ["Ignoring Python copies", "Slicing, concatenation, immutable string building, and comprehensions create work and memory."],
    ["Dropping all constants too early", "First form the count correctly; simplify only after understanding the structure."],
    ["Confusing total calls with stack depth", "Time may count all tree nodes, while space counts only the deepest active path."],
]
story.append(table(mistakes, [61 * mm, 113 * mm]))
story += [
    P("How to explain complexity in an interview", "H2X"),
    callout("Four-sentence template", "<b>1.</b> Define n. <b>2.</b> State the dominant repeated operation and how often it runs. <b>3.</b> Combine the costs and simplify. <b>4.</b> State auxiliary space and what creates it."),
    P("<b>Example:</b> \"Let n be the number of elements. We scan the list once, and each set lookup is expected O(1), so the total expected time is O(n). The set can hold up to n elements, so auxiliary space is O(n).\""),
    P("Fast estimation checklist", "H2X"),
    *bullets([
        "Look for sorting first: it often establishes an O(n log n) floor.",
        "Track pointer movement, not just loop nesting.",
        "For recursion, identify branching factor, depth, and work per call.",
        "For dynamic programming, estimate number of states * work per state.",
        "For graphs, ask whether representation is an adjacency list or matrix.",
        "State average vs worst case for hash tables.",
    ]),
]
story.append(PageBreak())

# Practice
story += section("Practice Problems - Try Before Checking Answers", 10)
story += [P("For each problem, identify time complexity and auxiliary space complexity. Define n clearly. Do not reveal the answer key until you have written your reasoning.")]

practice = [
("Easy 1", """
def first(values):
    return values[0] if values else None
"""),
("Easy 2", """
def count_positive(values):
    count = 0
    for value in values:
        if value > 0:
            count += 1
    return count
"""),
("Easy 3", """
def print_pairs(values):
    for left in values:
        for right in values:
            print(left, right)
"""),
("Medium 1", """
def mystery(n):
    result = 0
    while n > 1:
        n //= 2
        result += 1
    return result
"""),
("Medium 2", """
def duplicates(values):
    seen = set()
    for value in values:
        if value in seen:
            return True
        seen.add(value)
    return False
"""),
("Medium 3", """
def prefixes(text):
    result = []
    for i in range(len(text)):
        result.append(text[:i])
    return result
"""),
]
for label, snippet in practice:
    story += [P(label, "H2X"), code(snippet), Spacer(1, 2 * mm)]
story.append(PageBreak())

practice2 = [
("Medium 4", """
def ordered_pairs(values):
    for i in range(len(values)):
        for j in range(i + 1, len(values)):
            use(values[i], values[j])
"""),
("Medium 5", """
def repeated_search(sorted_values, targets):
    for target in targets:
        binary_search(sorted_values, target)
"""),
("Hard 1", """
def strange(n):
    if n <= 1:
        return 1
    return strange(n // 2) + strange(n // 2)
"""),
("Hard 2", """
def combinations(values):
    result = []
    def backtrack(index, path):
        if index == len(values):
            result.append(path.copy())
            return
        backtrack(index + 1, path)
        path.append(values[index])
        backtrack(index + 1, path)
        path.pop()
    backtrack(0, [])
    return result
"""),
("Hard 3", """
def matrix_scan(matrix):
    for row in matrix:
        for value in row:
            visit(value)
"""),
]
for label, snippet in practice2:
    story += [P(label, "H2X"), code(snippet), Spacer(1, 2 * mm)]
story += [
    callout("Reflection prompts", "Which problem was easiest to misread? Where did Python create a hidden copy? Which answer depends on two independent input sizes rather than one n?", HexColor("#FFF4E5")),
    PageBreak(),
]

# Answer key
story += section("Answer Key with Reasoning", 11)
answers = [
    ("Easy 1", "O(1) time, O(1) auxiliary space. A fixed number of operations occurs regardless of list length."),
    ("Easy 2", "Theta(n) time, O(1) auxiliary space. Every element is checked once."),
    ("Easy 3", "Theta(n^2) time, O(1) auxiliary space excluding output/printing system buffers. The print executes n*n times."),
    ("Medium 1", "O(log n) time, O(1) space. Each iteration halves n."),
    ("Medium 2", "Expected O(n) time and O(n) space. Each item receives an expected O(1) set lookup and insertion; the set may store all n values."),
    ("Medium 3", "O(n^2) time and O(n^2) output space. Slice lengths are 0,1,2,...,n-1, whose total is Theta(n^2)."),
    ("Medium 4", "Theta(n^2) time and O(1) auxiliary space. The inner executions total n(n-1)/2."),
    ("Medium 5", "If s is the sorted list length and t is target count, time is O(t log s), space O(1) for iterative binary search. If both are n, this becomes O(n log n)."),
    ("Hard 1", "Theta(n) time and O(log n) stack space. The recursion tree has about n leaves, but its depth is log n."),
    ("Hard 2", "Theta(n*2^n) time and output space when copying/storing all subsets. There are 2^n subsets, and each copied path may contain up to n values. Stack/path auxiliary space excluding output is O(n)."),
    ("Hard 3", "Use total element count, not automatically n^2. If row lengths are r1...rk, time is Theta(r1+...+rk). For an n by n matrix, it is Theta(n^2). Auxiliary space is O(1)."),
]
for title, answer in answers:
    story += [P(title, "H2X"), P(answer)]
story += [
    Spacer(1, 3 * mm),
    callout("Final confidence test", "When you see new code, say out loud: \"n means..., this operation repeats..., the total count is..., so time is..., and extra memory is...\" If every blank is explicit, your analysis is usually defensible.", HexColor("#EAF7F1")),
    P("One-page mental model", "H2X"),
]
story.append(table([
    ["Question", "What to inspect"],
    ["What grows?", "Input length, dimensions, vertices/edges, digits, states"],
    ["What repeats?", "Loop body, recursive call, copy, lookup, merge"],
    ["How does the problem shrink?", "By 1, by half, or into multiple branches"],
    ["How do blocks combine?", "Sequential: add. Nested: count total combinations."],
    ["What memory accumulates?", "Results, sets/maps, slices, stack frames, queues"],
    ["What dominates?", "Keep the fastest-growing non-zero term"],
], [54 * mm, 120 * mm]))


def on_page(canvas_obj, doc):
    if doc.page == 1:
        return
    canvas_obj.saveState()
    canvas_obj.setFillColor(BLUE)
    canvas_obj.rect(0, A4[1] - 7 * mm, A4[0], 7 * mm, fill=1, stroke=0)
    canvas_obj.restoreState()


doc = BaseDocTemplate(
    str(OUT),
    pagesize=A4,
    rightMargin=18 * mm,
    leftMargin=18 * mm,
    topMargin=18 * mm,
    bottomMargin=20 * mm,
    title="Time and Space Complexity in Python",
    author="OpenAI Codex",
    subject="Intuition-first algorithm complexity study guide",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
doc.addPageTemplates([PageTemplate(id="main", frames=frame, onPage=on_page)])
doc.build(story, canvasmaker=NumberedCanvas)
print(OUT)
