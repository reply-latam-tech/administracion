inf = {
    '2026-04-01': 0.026, '2026-05-01': 0.021, '2026-06-01': 0.019,
    '2026-07-01': 0.021, '2026-08-01': 0.017, '2026-09-01': 0.019,
    '2026-10-01': 0.017, '2026-11-01': 0.016, '2026-12-01': 0.018,
    '2027-01-01': 0.016, '2027-02-01': 0.016, '2027-03-01': 0.017,
    '2027-04-01': 0.014, '2027-05-01': 0.014, '2027-06-01': 0.014
}
tramos_base = [51537304.0, 73624721.0, 103074611.0, 139886972.0, 191424277.0, 279773943.0, 412298442.0, 588997775.0]
minimo_feb = 2834552.0
minimo_mar = round(minimo_feb * 1.029, 2)
tramos_mar = [round(x * 1.029, 2) for x in tramos_base]
minimo_abr = 2754698.0
tramos_abr = [round(x * 1.034, 2) for x in tramos_mar]

q3 = (1 + inf['2026-04-01']) * (1 + inf['2026-05-01']) * (1 + inf['2026-06-01'])
minimo_jul = round(minimo_abr * q3, 2)
tramos_jul = [round(x * q3, 2) for x in tramos_abr]

q4 = (1 + inf['2026-07-01']) * (1 + inf['2026-08-01']) * (1 + inf['2026-09-01'])
minimo_oct = round(minimo_jul * q4, 2)
tramos_oct = [round(x * q4, 2) for x in tramos_jul]

q1_27 = (1 + inf['2026-10-01']) * (1 + inf['2026-11-01']) * (1 + inf['2026-12-01'])
minimo_ene27 = round(minimo_oct * q1_27, 2)
tramos_ene27 = [round(x * q1_27, 2) for x in tramos_oct]

q2_27 = (1 + inf['2027-01-01']) * (1 + inf['2027-02-01']) * (1 + inf['2027-03-01'])
minimo_abr27 = round(minimo_ene27 * q2_27, 2)
tramos_abr27 = [round(x * q2_27, 2) for x in tramos_ene27]

q3_27 = (1 + inf['2027-04-01']) * (1 + inf['2027-05-01']) * (1 + inf['2027-06-01'])
minimo_jul27 = round(minimo_abr27 * q3_27, 2)
tramos_jul27 = [round(x * q3_27, 2) for x in tramos_abr27]

headers = ["Tier", "Alicuota", "Feb-26 (Base)", "Mar-26 (+2.9%)", "Abr-Jun 26 (Pactado)", "Jul-Sep 26 (+6.74%)", "Oct-Dic 26 (+5.81%)", "Ene-Mar 27 (+5.19%)"]
alicuotas = ["5.50%", "4.50%", "4.25%", "3.75%", "3.50%", "3.00%", "2.50%", "2.00%"]

print("\nTABLA COMPARATIVA DE ESCALA COMPLETA (TRAMOS Y MINIMO):")
print("-" * 125)
print(f"{headers[0]:<8} | {headers[1]:<8} | {headers[2]:<14} | {headers[3]:<14} | {headers[4]:<20} | {headers[5]:<19} | {headers[6]:<19} | {headers[7]:<19}")
print("-" * 125)
print(f"{'Minimo':<8} | {'-':<8} | {minimo_feb:>14,.2f} | {minimo_mar:>14,.2f} | {minimo_abr:>20,.2f} | {minimo_jul:>19,.2f} | {minimo_oct:>19,.2f} | {minimo_ene27:>19,.2f}")
for i in range(8):
    print(f"{'T' + str(i+1):<8} | {alicuotas[i]:<8} | {tramos_base[i]:>14,.2f} | {tramos_mar[i]:>14,.2f} | {tramos_abr[i]:>20,.2f} | {tramos_jul[i]:>19,.2f} | {tramos_oct[i]:>19,.2f} | {tramos_ene27[i]:>19,.2f}")
