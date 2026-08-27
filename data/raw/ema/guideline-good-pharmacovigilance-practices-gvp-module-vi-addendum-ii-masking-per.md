---
title: guideline-good-pharmacovigilance-practices-gvp-module-vi-addendum-ii-masking-per
country: 欧盟
category: 指南
sourceUrl: https://www.ema.europa.eu/en/documents/regulatory-procedural-guideline/guideline-good-pharmacovigilance-practices-gvp-module-vi-addendum-ii-masking-personal-data-individual-case-safety-reports-submitted-eudravigilance_en.pdf
---

22 July
Module VI Addendum II – Masking of personal data in individual case safety
reports submitted to EudraVigilance
Draft agreed by the Agency’s Pharmacovigilance Risk Assessment14 May 2025
Committee (PRAC) and finalised by the Agency in collaboration with
Member States
Draft agreed by the Co-ordination group for Mutual recognition and22 July 2025
Decentralised procedures – human (CMDh)
Draft agreed by the Head of Human Medicines Division as final under22 July 2025
delegated authority by the Executive Director
Date for coming into effect* 25 July 2025
As part of finalisation, the document was consulted with the EudraVigilance Expert Working Group.
* Senders of individual case safety reports should implement the instructions described in this document as soon
as possible and within a reasonable timeframe. Such timeframe should be documented as part of the sender’s
internal procedures to demonstrate when and how this will be achieved.
See websites for contact details
European Medicines Agency www.ema.europa.euThe European Medicines Agency is
Heads of Medicines Agencies www.hma.eu an agency of the European Union
© European Medicines Agency and Heads of Medicines Agencies, 2025.
Reproduction is authorised provided the source is acknowledged.

Table of contents
VI.Add.II.5. ICH-E2B(R3) data elements that may contain personal data and are
VI.Add.II.6. ICH-E2B(R3) data elements that do not contain personal data and are

VI.Add.II.. Introduction
As outcome of an EudraVigilance audit performed by the European Data Protection Supervisor (EDPS)
in the context of pseudonymisation procedures and personal data masking, the EDPS recommended to
the Agency to adopt, together with the joint controllers (European Commission and competent
authorities in Member States), a common masking policy that should be complied with by all entities
reporting to EudraVigilance (hereafter referred to as “sender”).
This Addendum to GVP Module VI provides instructions to complement Section VI.C.6.2.2.10. on data
protection laws. These instructions form an integral part of the guidance in GVP Module VI.
The Agency, in consultation with the joint controllers of EudraVigilance, has assessed all ICH-E2B(R3)
data elements (see Annex IV ICH-E2B(R)) to determine if the information in the data elements is
required in support of the pharmacovigilance and safety monitoring obligations set out in the EU
pharmaceutical legislation (see VI.Add.II..). More specifically, this assessment has taken into account
the relevant obligations placed on the Agency, competent authorities in Members States and the
Pharmacovigilance Risk Assessment Committee (PRAC) (see GVP Module I). Requirements to process
individual case safety reports (ICSRs) and to ensure adequate quality of the ICSRs (see GVP Module
VI) have also been reviewed.
All senders of ICSRs to EudraVigilance are expected to comply with the instructions set out in this
Addendum to GVP Module VI, and the data fields to be masked or not to be provided should not go
beyond the data fields described here.
The instructions do not change the current EudraVigilance Business Rules, therefore no impact on the
electronic submission process of ICSRs and related safety messages is expected. Moreover, the EU
Individual Case Safety Report Implementation Guide does also not require to be changed and remains
applicable.
XML files of ICSRs as submitted by senders will be preserved in their original form by the Agency for
regulatory and audit purposes. Access to these submissions is restricted to a limited number of
authorised Agency staff members who can make the XML files available to competent authorities in the
Member States for the purpose of inspections of sponsors of clinical trials, marketing authorisation
applicants and marketing authorisation holders.
VI.Add.II.. Purposes of personal data processing
The EU legal requirements for the collection and submission of ICSRs to EudraVigilance are established
in Directive 2001/83/EC as amended, Regulation (EC) No 726/2004 as amended and the Commission
Implementing Regulation 520/2012 as amended (see GVP Module VI). The EU legal requirements for
the collection and submission of suspected unexpected serious adverse reactions from interventional
clinical trials are established in the Regulation (EU) No 536/2014 (see EudraLex Volume 10 of The
Rules Governing Medicinal Products in the European Union).
The processing of personal data in relation to pharmacovigilance activities is necessary for the reasons
set out in:
• Chapter III of Commission Implementing Regulation (EU) 520/2012 on the performance of
pharmacovigilance activities provided for in Regulation (EC) No 726/2004 and Directive
www.ema.europa.eu - European Medicines Agency’s Data Protection Notice for EudraVigilance Human (EV)
(EMA/381993/2024)
www.ema.europa.eu
www.ema.europa.eu
www.health.ec.europa.eu

2001/83/EC which provide for the minimum requirements for the monitoring of data in
EudraVigilance;
• Commission Implementing Regulation (EU) 2022/20 which lays down the rules for the application
of Regulation (EU) No 536/2014 and setting up the rules and procedures for the cooperation of the
Member States in the safety assessment of clinical trials: In accordance with Article 5(1) of the
Commission Implementing Regulation (EU) 2022/20, the safety assessing Member State shall
amongst other tasks screen and assess information about all suspected unexpected serious
adverse reactions reported to the EudraVigilance database in accordance with Article 42 of
Regulation (EU) No 536/2014, regardless of whether they occurred in Member States or in third
countries, as well as information contained in annual safety reports, in accordance with Articles 6
and 7 of the Commission Implementing Regulation (EU) 2022/20 following a risk based approach;
• GVP Module IX further outlines the signal management process and the roles and responsibilities of
all parties involved.
ICSRs, recorded in EudraVigilance for the purpose of safety monitoring and patient and public health
protection, contain personal data of patients and of the primary source of the ICSR in pseudonymised
format. These personal data can be captured in structured as well as unstructured format based on
the ISO ICSR standard which is referenced in Article 2 of the Commission Implementing Regulation
(EC) No 520/2012.
Hence, as part of the safety monitoring responsibilities, ICSRs that contain pseudonymised personal
data can be accessed by registered users of the EudraVigilance system. In this regard, the user access
is protected by multi-factor authentication (MFA). The users that can access the data (depending on
their roles and permissions) are those with safety officer functions in competent authorities in Member
States, the European Commission and the Agency. Moreover, the access is extended according to the
EMA Policy on Access to EudraVigilance Data for Medicinal Products for Human Use for marketing
authorisation holders, so they can fulfil their pharmacovigilance obligations, and to clinical trial
sponsors to the ICSRs they have submitted to EudraVigilance, to facilitate their safety monitoring
activities. This policy describes the different levels of access and the means for the access by the
different stakeholders according to their safety monitoring obligations.
VI.Add.II.3. ICH-E2B(R3) data elements to be masked
For the 13 data elements provided in Table VI.Add.II.1. the sender of the ICSRs should determine if
the use of nullFlavors is applicable, in accordance with the ICH-E2B(R3) guideline (see Annex IV ICH-
E2B(R)) and the EU Individual Case Safety Report Implementation Guide Implementation Guide.
These 13 data elements are not required for signal management, duplicate detection or ICSR
processing.
These data elements should therefore be set with the nullFlavour MSK, provided that data are available
to the sender of the ICSR to EudraVigilance.
Other nullFlavours may be applicable when the data is not available to the sender (e.g. ASKU, NASK,
UNK) and should be used accordingly. Alternatively, the field(s) can be left blank. Further guidance on
the use of nullFlavours is provided in the EU Individual Case Safety Report Implementation Guide.
Web-based fields completed by the user when populating an application form
www.ema.europa.eu
www.ema.europa.eu
www.ema.europa.eu
www.ema.europa.eu

In instances where unmasked data are submitted to EudraVigilance by a sender for any of these
data elements due to failure of compliance with the instructions in this Addendum, the Agency will not
make the unmasked data available to the EudraVigilance users. Similarly, for legacy data held in
EudraVigilance related to these 13 data elements, the Agency will mask the data.
Table VI.Add.II.1.: 13 ICSR data elements to ALWAYS be masked by the sender of ICSRs to EudraVigilance (provided
that the data are available to the sender)
Field Identification ICH or EU E2B(R3) Data Elements in line with EU ICSR Implementation Guide
ICH E2B(R3)
Field ICH
data elementData field name
or EU
reference
ICH C.2.r.1.1 Reporter’s Title
ICH C.2.r.1.2 Reporter’s Given Name
ICH C.2.r.1.3 Reporter’s Middle Name
ICH C.2.r.1.4 Reporter’s Family Name
ICH C.2.r.2.1 Reporter’s Organisation
ICH C.2.r.2.2 Reporter’s Department
ICH C.2.r.2.3 Reporter’s Street
ICH C.2.r.2.6 Reporter’s Postcode
ICH C.2.r.2.7 Reporter’s Telephone
Patient Medical Record Number(s) and Source(s) of the Record Number (GP
ICH D.1.1.1
Medical Record Number)
Patient Medical Record Number(s) and Source(s) of the Record Number
ICH D.1.1.2
(Specialist Record Number)
Patient Medical Record Number(s) and Source(s) of the Record Number
ICH D.1.1.3
(Hospital Record Number)
ICH D.10.1 Parent Identification
VI.Add.II.4. ICH-E2B(R3) data elements to be left blank
The 11 data elements provided in Table VI.Add.II.2. are also not necessary for signal management,
duplicate detection or ICSR processing. Since the use of nullFlavors is not supported by the ICH
E2B(R3) guideline (see Annex IV ICH-E2B(R)), the sender of the ICSRs should leave these 11 data
elements blank when submitting ICSRs to EudraVigilance.
In instances where data are submitted to EudraVigilance by a sender for any of these 11 data elements
due to failure of compliance with the instructions in this Addendum, the Agency will not make the data
available to the EudraVigilance users. Similarly, for legacy data held in EudraVigilance related to these
11 data elements, the Agency will remove the data.
Table VI.Add.II.2.: 11 ICSR data elements to ALWAYS be left blank by the sender of ICSRs to EudraVigilance (provided
that the data are available to the sender)

Field Identification ICH or EU E2B(R3) Data Elements in line with EU ICSR Implementation Guide
ICH E2B(R3)
Field ICH
data elementData field name
or EU
reference
ICH C.3.3.2 Sender’s Title
ICH C.3.3.3 Sender’s Given Name
ICH C.3.3.4 Sender’s Middle Name
ICH C.3.3.5 Sender’s Family Name
ICH C.3.4.1 Sender’s Street Address
ICH C.3.4.2 Sender’s City
ICH C.3.4.3 Sender’s State or Province
ICH C.3.4.4 Sender’s Postcode
ICH C.3.4.5 Sender’s Country Code
ICH C.3.4.6 Sender’s Telephone
ICH C.3.4.7 Sender’s Fax
VI.Add.II.. ICH-E2B(R3) data elements that may contain
personal data and are required for pharmacovigilance
processes
The data elements provided in Table VI.Add.II.. may contain personal identifiers or quasi-identifiers
and are required for signal management, duplicate detection and ICSR processing. When available,
data related to these data elements should not be masked or not to be left blank by the senders of the
ICSR to EudraVigilance.
Table VI.Add.II.3.: ICSR data elements that may contain personal identifiers or quasi-identifiers and are required for
signal management, duplicate detection and ICSR processing and should not be masked and not be left blank
Field Identification ICH or EU E2B(R3) Data Elements in line with EU ICSR Implementation Guide
Field ICHICH E2B(R3) data
Data field name
or EUelement reference
ICH C.1.1 Sender’s (case) Safety Report Unique Identifier
ICH C.1.6.1.r.1 Documents Held by Sender
ICH C.1.6.1.r.2 Included Documents
ICH C.1.8.1 Worldwide Unique Case Identification
ICH C.1.9.1 Other Case Identifiers in Previous Transmissions
ICH C.1.9.1.r.1 Source(s) of the Case Identifier
ICH C.1.9.1.r.2 Case Identifier(s)
ICH C.1.10.r Identification Number of the Report Which Is Linked to This Report
ICH C.2.r.2.4 Reporter’s City

Field Identification ICH or EU E2B(R3) Data Elements in line with EU ICSR Implementation Guide
Field ICHICH E2B(R3) data
Data field name
or EUelement reference
ICH C.2.r.2.5 Reporter’s State or Province
ICH C.2.r.3 Reporter’s Country Code
ICH C.3.2 Sender’s Organisation
ICH C.3.3.1 Sender’s Department
ICH C.3.4.8 Sender’s E-mail Address
ICH C.4.r.1 Literature Reference(s)
ICH C.4.r.2 Included Documents
ICH C.5.1.r.1 Study Registration Number
ICH C.5.1.r.2 Study Registration country
ICH C.5.2 Study Name
ICH C.5.3 Sponsor Study Number
ICH C.5.4 Study Type Where Reaction(s) / Event(s) Were Observed
Study Type Where Reaction(s) / Event(s) Were Observed Code System
ICH_CSV C.5.4.CSV
Version
ICH D.1 Patient (name or initials)
Patient Medical Record Number(s) and Source(s) of the Record Number
ICH D.1.1.4
(Investigation Number)
ICH D.2.1 Date of Birth
ICH D.2.2a Age at Time of Onset of Reaction / Event (number)
ICH D.2.2b Age at Time of Onset of Reaction / Event (unit)
Gestation Period When Reaction / Event Was Observed in the Foetus
ICH D.2.2.1a
(number)
ICH D.2.2.1b Gestation Period When Reaction/Event Was Observed in the Foetus (unit)
ICH D.2.3 Patient Age Group (as per reporter)
ICH D.3 Body Weight (kg)
ICH D.4 Height (cm)
ICH D.5 Sex
ICH D.6 Last Menstrual Period Date
ICH D.7.1.r.1b Medical History (disease / surgical procedure / etc.) (MedDRA code)
ICH D.7.1.r.2 Start Date
ICH D.7.1.r.3 Continuing
ICH D.7.1.r.4 End Date
ICH D.7.1.r.5 Comments
ICH D.7.1.r.6 Family History
Text for Relevant Medical History and Concurrent Conditions (not including
ICH D.7.2
reaction/event)
ICH D.7.3 Concomitant Therapies
ICH D.8.r.1 Name of Drug as Reported
EU D.8.r.1.EU.1 Name part - Invented name

Field Identification ICH or EU E2B(R3) Data Elements in line with EU ICSR Implementation Guide
Field ICHICH E2B(R3) data
Data field name
or EUelement reference
EU D.8.r.1.EU.2 Name part - Scientific name
EU D.8.r.1.EU.3 Name part - Trademark name
EU D.8.r.1.EU.4 Name part - Strength name
EU D.8.r.1.EU.5 Name part - Form name
EU D.8.r.1.EU.6 Name part - Container name
EU D.8.r.1.EU.7 Name part - Device name
EU D.8.r.1.EU.8 Name part - Intended use name
ICH D.8.r.2b Medicinal Product Identifier (MPID)
ICH D.8.r.3b Pharmaceutical Product Identifier (PhPID)
EU D.8.r.EU.r.1 Substance/ Specified Substance Name
EU D.8.r.EU.r.2b Substance/Specified Substance TermID
EU D.8.r.EU.r.3a Strength (number)
EU D.8.r.EU.r.3b Strength (unit)
ICH D.8.r.4 Start Date
ICH D.8.r.5 End Date
ICH D.8.r.6b Indication (MedDRA code)
ICH D.8.r.7b Reaction (MedDRA code)
ICH D.9.1 Date of Death
ICH D.9.2.r.1b Reported Cause(s) of Death (MedDRA code)
ICH D.9.2.r.2 Reported Cause(s) of Death (free text)
ICH D.9.3 Was Autopsy Done?
ICH D.9.4.r.1b Autopsy-determined Cause(s) of Death (MedDRA code)
ICH D.9.4.r.2 Autopsy-determined Cause(s) of Death (free text)
ICH D.10.2.1 Date of Birth of Parent
ICH D.10.2.2a Age of Parent (number)
ICH D.10.2.2b Age of Parent (unit)
ICH D.10.3 Last Menstrual Period Date of Parent
ICH D.10.4 Body Weight (kg) of Parent
ICH D.10.5 Height (cm) of Parent
ICH D.10.6 Sex of Parent
ICH D.10.7.1.r.1b Medical History (disease / surgical procedure / etc.) (MedDRA code)
ICH D.10.7.1.r.2 Start Date
ICH D.10.7.1.r.3 Continuing
ICH D.10.7.1.r.4 End Date
ICH D.10.7.1.r.5 Comments
ICH D.10.7.2 Text for Relevant Medical History and Concurrent Conditions of Parent

Field Identification ICH or EU E2B(R3) Data Elements in line with EU ICSR Implementation Guide
Field ICHICH E2B(R3) data
Data field name
or EUelement reference
ICH D.10.8.r.1 Name of Drug as Reported
EU D.10.8.r.1.EU.1 Name part - Invented name
EU D.10.8.r.1.EU.2 Name part - Scientific name
EU D.10.8.r.1.EU.3 Name part - Trademark name
EU D.10.8.r.1.EU.4 Name part - Strength name
EU D.10.8.r.1.EU.5 Name part - Form name
EU D.10.8.r.1.EU.6 Name part - Container name
EU D.10.8.r.1.EU.7 Name part - Device name
EU D.10.8.r.1.EU.8 Name part - Intended use name
ICH D.10.8.r.2b Medicinal Product Identifier (MPID)
ICH D.10.8.r.3b Pharmaceutical Product Identifier (PhPID)
EU D.10.8.r.EU.r.1 Substance/Specified Substance Name
EU D.10.8.r.EU.r.2b Substance/Specified Substance TermID
EU D.10.8.r.EU.r.3a Strength (number)
EU D.10.8.r.EU.r.3b Strength (unit)
ICH D.10.8.r.4 Start Date
ICH D.10.8.r.5 End Date
ICH D.10.8.r.6b Indication (MedDRA code)
ICH D.10.8.r.7b Reactions (MedDRA code)
ICH E.i.1.1a Reaction/Event as Reported by the Primary Source in Native Language
ICH E.i.1.1b Reaction/Event as Reported by the Primary Source Language
ICH E.i.1.2 Reaction/Event as Reported by the Primary Source for Translation
ICH E.i.2.1b Reaction/Event (MedDRA code)
ICH E.i.3.2a Results in Death
ICH E.i.3.2b Life-threatening
ICH E.i.3.2c Caused/Prolonged Hospitalisation
ICH E.i.3.2d Disabling/Incapacitating
ICH E.i.3.2e Congenital Anomaly/Birth Defect
ICH E.i.3.2f Other Medically Important Condition
ICH E.i.4 Date of Start of Reaction/Event
ICH E.i.5 Date of End of Reaction/Event
ICH E.i.6a Duration of Reaction/Event (number)
ICH E.i.6b Duration of Reaction/Event (unit)
ICH E.i.7 Outcome of Reaction/Event at the Time of Last Observation
ICH E.i.9 Identification of the Country Where the Reaction/Event Occurred
ICH F.r.1 Test Date

Field Identification ICH or EU E2B(R3) Data Elements in line with EU ICSR Implementation Guide
Field ICHICH E2B(R3) data
Data field name
or EUelement reference
ICH F.r.2.1 Test Name (free text)
ICH F.r.2.2b Test Name (MedDRA code)
ICH F.r.3.1 Test Result (code)
ICH F.r.3.2 Test Result (value / qualifier)
ICH F.r.3.3 Test Result (unit)
ICH F.r.3.4 Result Unstructured Data (free text)
ICH F.r.6 Comments (free text)
ICH F.r.7 More Information Available
ICH G.k.1 Characterisation of Drug Role
ICH G.k.2.1.1b Medicinal Product Identifier (MPID)
ICH G.k.2.1.2b Pharmaceutical Product Identifier (PhPID)
ICH G.k.2.2 Medicinal Product Name as Reported by the Primary Source
EU G.k.2.2.EU.1 Name part - Invented name
EU G.k.2.2.EU.2 Name part - Scientific name
EU G.k.2.2.EU.3 Name part - Trademark name
EU G.k.2.2.EU.4 Name part - Strength name
EU G.k.2.2.EU.5 Name part - Form name
EU G.k.2.2.EU.6 Name part - Container name
EU G.k.2.2.EU.7 Name part - Device name
EU G.k.2.2.EU.8 Name part - Intended use name
EU G.k.2.2.EU.9.r.1 Device Component name (free text)
EU G.k.2.2.EU.9.r.3 Device Component TermID
EU G.k.2.2.EU.9.r.4 Device Serial Number
ICH G.k.2.3.r.1 Substance/Specified Substance Name
ICH G.k.2.3.r.2b Substance/Specified Substance TermID
ICH G.k.2.3.r.3a Strength (number)
ICH G.k.2.3.r.3b Strength (unit)
ICH G.k.2.4 Identification of the Country Where the Drug Was Obtained
ICH G.k.2.5 Investigational Product Blinded
ICH G.k.3.1 Authorisation/Application Number
ICH G.k.3.2 Country of Authorisation/Application
ICH G.k.3.3 Name of Holder/Applicant
ICH G.k.4.r.1a Dose (number)
ICH G.k.4.r.1b Dose (unit)
ICH G.k.4.r.2 Number of Units in the Interval
ICH G.k.4.r.3 Definition of the Time Interval Unit

Field Identification ICH or EU E2B(R3) Data Elements in line with EU ICSR Implementation Guide
Field ICHICH E2B(R3) data
Data field name
or EUelement reference
ICH G.k.4.r.4 Date and Time of Start of Drug
ICH G.k.4.r.5 Date and Time of Last Administration
ICH G.k.4.r.6a Duration of Drug Administration (number)
ICH G.k.4.r.6b Duration of Drug Administration (unit)
ICH G.k.4.r.7 Batch/Lot Number
ICH G.k.4.r.8 Dosage Text
ICH G.k.4.r.9.1 Pharmaceutical Dose Form (free text)
ICH G.k.4.r.9.2b Pharmaceutical Dose Form TermID
ICH G.k.4.r.10.1 Route of Administration (free text)
ICH G.k.4.r.10.2b Route of Administration TermID
ICH G.k.4.r.11.1 Parent Route of Administration (free text)
ICH G.k.4.r.11.2b Parent Route of Administration TermID
ICH G.k.5a Cumulative Dose to First Reaction (number)
ICH G.k.5b Cumulative Dose to First Reaction (unit)
ICH G.k.6a Gestation Period at Time of Exposure (number)
ICH G.k.6b Gestation Period at Time of Exposure (unit)
ICH G.k.7.r.1 Indication as Reported by the Primary Source
ICH G.k.7.r.2b Indication (MedDRA code)
ICH G.k.8 Action(s) Taken with Drug
ICH G.k.9.i.2.r.2 Method of Assessment
ICH G.k.9.i.2.r.3 Result of Assessment
EU G.k.9.i.2.r.3.EU.1 EU Result of Assessment
Time Interval between Last Dose of Drug and Start of Reaction/Event
ICH G.k.9.i.3.2a
(number)
ICH G.k.9.i.3.2b Time Interval between Last Dose of Drug and Start of Reaction/Event (unit)
ICH G.k.9.i.4 Did Reaction Recur on Re-administration?
ICH G.k.10.r Additional Information on Drug (coded) (repeat as necessary)
ICH G.k.11 Additional Information on Drug (free text)
Case Narrative Including Clinical Course, Therapeutic Measures, Outcome and
ICH H.1
Additional Relevant Information
ICH H.2 Reporter's Comments
Sender's Diagnosis/Syndrome and/or Reclassification of Reaction/Event
ICH H.3.r.1b
(MedDRA code)
ICH H.4 Sender's Comments
ICH H.5.r.1a Case Summary and Reporter’s Comments Text
ICH H.5.r.1b Case Summary and Reporter’s Comments Language

VI.Add.II.. ICH-E2B(R3) data elements that do not contain
personal data and are required for pharmacovigilance
processes
The data elements provided in Table VI.Add.II.4. do not contain personal identifiers or quasi-identifiers
and are required for signal management, duplicate detection and ICSR processing. When available,
data related to these data elements should not be masked and not be left blank by the senders of the
ICSR to EudraVigilance.
Table VI.Add.II.4. ICSR data elements that do not contain personal identifiers or quasi-identifiers and are required for
signal management, duplicate detection and ICSR processing and should not be masked and not be left blank
Field Identification ICH or EU E2B(R3) Data Elements in line with EU ICSR Implementation Guide
ICSR ICH E2B(R3)
Field ICH
data elementData field name
or EU
reference
ICH N.1.1 Types of Message in Batch
ICH N.1.1.CSV Types of Message in Batch Code System Version
ICH N.1.2 Batch Number
ICH N.1.3 Batch Sender Identifier
ICH N.1.4 Batch Receiver Identifier
ICH N.1.5 Date of Batch Transmission
ICH N.2.r.1 Message Identifier
ICH N.2.r.2 Message Sender Identifier
ICH N.2.r.3 Message Receiver Identifier
ICH N.2.r.4 Date of Message Creation
ICH C.1.2 Date of Creation
ICH C.1.3 Type of Report
ICH C.1.3.CSV Type of Report Code System Version
ICH C.1.4 Date Report Was First Received from Source
ICH C.1.5 Date of Most Recent Information for This Report
ICH C.1.6.1 Are Additional Documents Available?
ICH C.1.7 Does This Case Fulfil the Local Criteria for an Expedited Report?
ICH C.1.8.2 First Sender of This Case
ICH_CSV C.1.8.2.CSV First Sender of This Case Code System Version
ICH C.1.11.1 Report Nullification/Amendment
ICH_CSV C.1.11.1.CSV Report Nullification/Amendment Code System Version
ICH C.1.11.2 Reason for Nullification/Amendment
ICH C.2.r.4 Qualification
ICH_CSV C.2.r.4.CSV Qualification Code System Version
ICH C.2.r.5 Primary Source for Regulatory Purposes
ICH C.3.1 Sender Type

Field Identification ICH or EU E2B(R3) Data Elements in line with EU ICSR Implementation Guide
ICSR ICH E2B(R3)
Field ICH
data elementData field name
or EU
reference
ICH_CSV C.3.1.CSV Sender Type Code System Version
ICH_CSV D.2.3.CSV Patient Age Group (as per reporter) Code System Version
ICH D.7.1.r.1a MedDRA Version for Medical History
ICH D.8.r.2a MPID Version Date/Number
ICH D.8.r.3a PhPID Version Date/Number
EU D.8.r.EU.r.2a Substance/Specified Substance TermID Version Date/Number
ICH D.8.r.6a MedDRA Version for Indication
ICH D.8.r.7a MedDRA Version for Reaction
ICH D.9.2.r.1a MedDRA Version for Reported Cause(s) of Death
ICH D.9.4.r.1a MedDRA Version for Autopsy-determined Cause(s) of Death
ICH D.10.7.1.r.1a MedDRA Version for Medical History
ICH D.10.8.r.2a MPID Version Date/Number
ICH D.10.8.r.3a PhPID Version Date/Number
EU D.10.8.r.EU.r.2a Substance/Specified Substance TermID Version Date/Number
ICH D.10.8.r.6a MedDRA Version for Indication
ICH D.10.8.r.7a MedDRA Version for Reaction
ICH E.i.2.1a MedDRA Version for Reaction/Event
ICH E.i.3.1 Term Highlighted by the Reporter
ICH_CSV E.i.3.1.CSV Term Highlighted by the Reporter Code System Version
Outcome of Reaction/Event at the Time of Last Observation Code System
ICH_CSV E.i.7.CSV
Version
ICH E.i.8 Medical Confirmation by Healthcare Professional
ICH F.r.2.2a MedDRA Version for Test Name
ICH_CSV F.r.3.1.CSV Test Result (code) Code System Version
ICH F.r.4 Normal Low Value
ICH F.r.5 Normal High Value
ICH_CSV G.k.1.CSV Characterisation of Drug Role Code System Version
ICH G.k.2.1.1a MPID Version Date / Number
ICH G.k.2.1.2a PhPID Version Date/Number
EU G.k.2.2.EU.9.r.2 Device Component TermID Version Date/Number
ICH G.k.2.3.r.2a Substance/Specified Substance TermID Version Date/Number
ICH G.k.4.r.9.2a Pharmaceutical Dose Form TermID Version Date/Number
ICH G.k.4.r.10.2a Route of Administration TermID Version Date/Number
ICH G.k.4.r.11.2a Parent Route of Administration TermID Version Date/Number
ICH G.k.7.r.2a MedDRA Version for Indication
ICH_CSV G.k.8.CSV Action(s) Taken with Drug Code System Version
ICH G.k.9.i.1 Reaction(s)/Event(s) Assessed

Field Identification ICH or EU E2B(R3) Data Elements in line with EU ICSR Implementation Guide
ICSR ICH E2B(R3)
Field ICH
data elementData field name
or EU
reference
ICH G.k.9.i.2.r.1 Source of Assessment
EU G.k.9.i.2.r.1.EU.1 EU Source of Assessment
EU_CSV G.k.9.i.2.r.1.EU.1.CSV EU Source of Assessment Code System Version
EU G.k.9.i.2.r.2.EU.1 EU Method of Assessment
EU_CSV G.k.9.i.2.r.2.EU.1.CSV EU Method of Assessment Code System Version
EU_CSV G.k.9.i.2.r.3.EU.1.CSV EU Result of Assessment Code System Version
Time Interval between Beginning of Drug Administration and Start of
ICH G.k.9.i.3.1a
Reaction/Event (number)
Time Interval between Beginning of Drug Administration and Start of
ICH G.k.9.i.3.1b
Reaction/Event (unit)
ICH_CSV G.k.9.i.4.CSV Did Reaction Recur on Re-administration? Code System Version
Additional Information on Drug (coded) (repeat as necessary) Code System
ICH_CSV G.k.10.r.CSV
Version
MedDRA Version for Sender's Diagnosis/Syndrome and/or Reclassification of
ICH H.3.r.1a
Reaction/Event
