import { Country, State } from "country-state-city";

const ZIP_RULES = {
    US: { re: /^\d{5}(-\d{4})?$/, hint: "5 digits, e.g. 79701 or 79701-1234" },
    CA: { re: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, hint: "A1A 1A1" },
    GB: {
        re: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/,
        hint: "SW1A 1AA",
    },
    AU: { re: /^\d{4}$/, hint: "4 digits" },
    MX: { re: /^\d{5}$/, hint: "5 digits" },
    IN: { re: /^\d{6}$/, hint: "6 digits" },
    DE: { re: /^\d{5}$/, hint: "5 digits" },
    FR: { re: /^\d{5}$/, hint: "5 digits" },
};

export function validateZip(zip, country) {
    const rule = ZIP_RULES[country];
    if (!rule || !zip) return null;
    return rule.re.test(zip.trim())
        ? null
        : `Invalid format — expected ${rule.hint}`;
}

export default function AddressFields({
    values,
    onChange,
    zipError,
    onZipBlur,
    errors = {},
    disabled = false,
    inputClassName = "",
    style,
}) {
    const country = values.country || "US";
    const countries = Country.getAllCountries();
    const states = State.getStatesOfCountry(country);

    const cls = (field) =>
        [inputClassName, errors[field] ? "is-invalid" : ""]
            .filter(Boolean)
            .join(" ");

    return (
        <div style={{ display: "grid", gap: 8, ...style }}>
            {/* Street */}
            <div>
                <input
                    type="text"
                    name="street"
                    placeholder="Street Address"
                    value={values.street || ""}
                    onChange={onChange}
                    disabled={disabled}
                    className={cls("street")}
                    style={{ width: "100%" }}
                />
                {errors.street && (
                    <div className="invalid-feedback d-block">
                        {errors.street}
                    </div>
                )}
            </div>

            {/* City / State / ZIP */}
            <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 2 }}>
                    <input
                        type="text"
                        name="city"
                        placeholder="City"
                        value={values.city || ""}
                        onChange={onChange}
                        disabled={disabled}
                        className={cls("city")}
                        style={{ width: "100%" }}
                    />
                    {errors.city && (
                        <div className="invalid-feedback d-block">
                            {errors.city}
                        </div>
                    )}
                </div>

                <div style={{ flex: 1 }}>
                    {states.length > 0 ? (
                        <select
                            name="state"
                            value={values.state || ""}
                            onChange={onChange}
                            disabled={disabled}
                            className={cls("state")}
                            style={{ width: "100%" }}
                        >
                            <option value="">State / Region</option>
                            {states.map((s) => (
                                <option key={s.isoCode} value={s.isoCode}>
                                    {s.isoCode} — {s.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            name="state"
                            placeholder="State / Region"
                            value={values.state || ""}
                            onChange={onChange}
                            disabled={disabled}
                            className={cls("state")}
                            style={{ width: "100%" }}
                        />
                    )}
                    {errors.state && (
                        <div className="invalid-feedback d-block">
                            {errors.state}
                        </div>
                    )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                        type="text"
                        name="zip"
                        placeholder="ZIP / Postal"
                        value={values.zip || ""}
                        onChange={onChange}
                        onBlur={onZipBlur}
                        disabled={disabled}
                        className={cls("zip")}
                        style={{ width: "100%" }}
                    />
                    {(zipError || errors.zip) && (
                        <div
                            className="invalid-feedback d-block"
                            style={{ color: "#b00020" }}
                        >
                            {zipError || errors.zip}
                        </div>
                    )}
                </div>
            </div>

            {/* Country */}
            <div>
                <select
                    name="country"
                    value={country}
                    onChange={onChange}
                    disabled={disabled}
                    className={cls("country")}
                    style={{ width: "100%" }}
                >
                    {countries.map((c) => (
                        <option key={c.isoCode} value={c.isoCode}>
                            {c.flag} {c.name}
                        </option>
                    ))}
                </select>
                {errors.country && (
                    <div className="invalid-feedback d-block">
                        {errors.country}
                    </div>
                )}
            </div>
        </div>
    );
}
