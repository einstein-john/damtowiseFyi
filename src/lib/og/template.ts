import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "../../contracts/index.js";

export interface OgImageContent {
  title: string;
  description: string | null;
  tags: string[];
  siteName: string;
}

const MAX_TITLE_LENGTH = 90;
const MAX_DESCRIPTION_LENGTH = 160;

type SatoriNode = Record<string, unknown>;

function text(value: string, style: SatoriNode, key: string): SatoriNode {
  return { type: "div", props: { style, children: value }, key };
}

/** Satori needs every text run wrapped in an explicit <div>. */
function clamp(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

export function buildOgImage(content: OgImageContent): SatoriNode {
  const children: SatoriNode[] = [
    text(clamp(content.title, MAX_TITLE_LENGTH), { fontSize: 62, fontWeight: 700, lineHeight: 1.15 }, "title"),
  ];

  if (content.description) {
    children.push(
      text(
        clamp(content.description, MAX_DESCRIPTION_LENGTH),
        { fontSize: 26, lineHeight: 1.4, opacity: 0.78, marginTop: 28 },
        "description",
      ),
    );
  }

  if (content.tags.length > 0) {
    children.push({
      type: "div",
      props: {
        style: { display: "flex", gap: 12, marginTop: "auto", paddingTop: 40 },
        children: content.tags.slice(0, 4).map((tag, index) =>
          text(`#${tag}`, {
            fontSize: 22,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.35)",
            borderRadius: 999,
            padding: "8px 18px",
            opacity: 0.85,
          }, `tag-${index}`),
        ),
      },
      key: "tags",
    });
  }

  children.push(
    text(content.siteName, { fontSize: 22, opacity: 0.6, marginTop: 32 }, "site"),
  );

  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "72px 80px",
        backgroundColor: "#0b0b0f",
        backgroundImage:
          "linear-gradient(135deg, #0b0b0f 0%, #141428 55%, #1d2a4a 100%)",
        color: "#f5f5f7",
        fontFamily: "JetBrains Mono",
      },
      children,
    },
    key: "root",
  };
}

export const OG_SIZE = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };