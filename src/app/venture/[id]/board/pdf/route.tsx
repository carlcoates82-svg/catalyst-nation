import { renderToBuffer } from "@react-pdf/renderer";
import { requireProfile } from "@/lib/auth";
import { getBoardPackData } from "@/lib/board-data";
import { BoardPackDocument } from "@/lib/board-pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireProfile();
  const { id } = await params;
  const ventureId = Number(id);
  const data = await getBoardPackData(ventureId);

  const buffer = await renderToBuffer(<BoardPackDocument {...data} />);
  const filename = `${data.venture.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-board-pack.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
