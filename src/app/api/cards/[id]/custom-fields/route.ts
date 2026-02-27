import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { cardCustomFieldValuesPatchSchema } from "@/lib/validation/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: cardId } = await params;
    const { supabase, user } = await requireApiUser();

    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, board_id")
      .eq("id", cardId)
      .maybeSingle();
    if (cardError) {
      throw new ApiError(500, "card_lookup_failed", cardError.message);
    }
    if (!card) {
      throw new ApiError(404, "card_not_found", "Card not found.");
    }

    await assertBoardRole(supabase, card.board_id, user.id, ["member"]);

    const { data, error } = await supabase
      .from("card_custom_field_values")
      .select("*")
      .eq("card_id", cardId);
    if (error) {
      throw new ApiError(500, "card_custom_field_values_lookup_failed", error.message);
    }

    return ok(data ?? []);
  } catch (error) {
    return fail(error as Error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: cardId } = await params;
    const payload = await parseBody(request, cardCustomFieldValuesPatchSchema);
    const { supabase, user } = await requireApiUser();

    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, board_id")
      .eq("id", cardId)
      .maybeSingle();
    if (cardError) {
      throw new ApiError(500, "card_lookup_failed", cardError.message);
    }
    if (!card) {
      throw new ApiError(404, "card_not_found", "Card not found.");
    }
    await assertBoardRole(supabase, card.board_id, user.id, ["member"]);

    const customFieldIds = Array.from(new Set(payload.values.map((entry) => entry.customFieldId)));
    if (customFieldIds.length) {
      const { data: fields, error: fieldsError } = await supabase
        .from("custom_fields")
        .select("id")
        .eq("board_id", card.board_id)
        .in("id", customFieldIds);
      if (fieldsError) {
        throw new ApiError(500, "custom_fields_lookup_failed", fieldsError.message);
      }
      const allowedIds = new Set((fields ?? []).map((field) => field.id));
      const invalid = customFieldIds.find((id) => !allowedIds.has(id));
      if (invalid) {
        throw new ApiError(400, "invalid_custom_field", "Card board and custom field mismatch.");
      }
    }

    const rowsForUpsert: Array<Record<string, unknown>> = [];
    const rowsForDelete: string[] = [];

    for (const entry of payload.values) {
      const normalizedText = entry.valueText?.trim() ? entry.valueText.trim() : null;
      const normalizedNumber = typeof entry.valueNumber === "number" ? entry.valueNumber : null;
      const normalizedDate = entry.valueDate ?? null;
      const normalizedBoolean =
        typeof entry.valueBoolean === "boolean" ? entry.valueBoolean : entry.valueBoolean === null ? null : null;
      const normalizedOption = entry.valueOption?.trim() ? entry.valueOption.trim() : null;

      const isEmpty =
        normalizedText === null &&
        normalizedNumber === null &&
        normalizedDate === null &&
        normalizedBoolean === null &&
        normalizedOption === null;

      if (isEmpty) {
        rowsForDelete.push(entry.customFieldId);
        continue;
      }

      rowsForUpsert.push({
        card_id: cardId,
        custom_field_id: entry.customFieldId,
        value_text: normalizedText,
        value_number: normalizedNumber,
        value_date: normalizedDate,
        value_boolean: normalizedBoolean,
        value_option: normalizedOption,
        updated_at: new Date().toISOString(),
      });
    }

    if (rowsForDelete.length) {
      const { error } = await supabase
        .from("card_custom_field_values")
        .delete()
        .eq("card_id", cardId)
        .in("custom_field_id", rowsForDelete);
      if (error) {
        throw new ApiError(500, "card_custom_field_values_delete_failed", error.message);
      }
    }

    if (rowsForUpsert.length) {
      const { error } = await supabase
        .from("card_custom_field_values")
        .upsert(rowsForUpsert, { onConflict: "card_id,custom_field_id" });
      if (error) {
        throw new ApiError(500, "card_custom_field_values_upsert_failed", error.message);
      }
    }

    const { data: values, error: valuesError } = await supabase
      .from("card_custom_field_values")
      .select("*")
      .eq("card_id", cardId);
    if (valuesError) {
      throw new ApiError(500, "card_custom_field_values_lookup_failed", valuesError.message);
    }

    await logActivity(supabase, {
      boardId: card.board_id,
      cardId,
      actorId: user.id,
      action: "card_custom_fields_updated",
      metadata: {
        count: payload.values.length,
      },
    });

    return ok(values ?? []);
  } catch (error) {
    return fail(error as Error);
  }
}
