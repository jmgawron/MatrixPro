from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models.catalog import Certificate, CertificationDomain, SkillCertificate
from app.models.user import User, UserRole
from app.schemas.catalog import (
    CertDomainCreate,
    CertDomainResponse,
    CertDomainUpdate,
    CertificateCreate,
    CertificateResponse,
    CertificateUpdate,
)

router = APIRouter(tags=["certification"])


@router.get("/api/certification-domains/", response_model=list[CertDomainResponse])
def list_cert_domains(
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    return db.query(CertificationDomain).order_by(CertificationDomain.name).all()


@router.post(
    "/api/certification-domains/",
    response_model=CertDomainResponse,
    status_code=201,
)
def create_cert_domain(
    data: CertDomainCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    cd = CertificationDomain(name=data.name, description=data.description)
    db.add(cd)
    db.commit()
    db.refresh(cd)
    return cd


@router.put(
    "/api/certification-domains/{cert_domain_id}",
    response_model=CertDomainResponse,
)
def update_cert_domain(
    cert_domain_id: int,
    data: CertDomainUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    cd = (
        db.query(CertificationDomain)
        .filter(CertificationDomain.id == cert_domain_id)
        .first()
    )
    if cd is None:
        raise HTTPException(status_code=404, detail="Certification domain not found")

    if data.name is not None:
        cd.name = data.name
    if data.description is not None:
        cd.description = data.description

    db.commit()
    db.refresh(cd)
    return cd


@router.delete("/api/certification-domains/{cert_domain_id}")
def delete_cert_domain(
    cert_domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    cd = (
        db.query(CertificationDomain)
        .filter(CertificationDomain.id == cert_domain_id)
        .first()
    )
    if cd is None:
        raise HTTPException(status_code=404, detail="Certification domain not found")

    cert_count = (
        db.query(Certificate)
        .filter(Certificate.certification_domain_id == cert_domain_id)
        .count()
    )
    if cert_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete domain with {cert_count} certificate(s)",
        )

    db.delete(cd)
    db.commit()
    return {"detail": "Certification domain deleted"}


@router.get("/api/certificates/", response_model=list[CertificateResponse])
def list_certificates(
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    return (
        db.query(Certificate)
        .order_by(Certificate.certification_domain_id, Certificate.name)
        .all()
    )


@router.post("/api/certificates/", response_model=CertificateResponse, status_code=201)
def create_certificate(
    data: CertificateCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    cd = (
        db.query(CertificationDomain)
        .filter(CertificationDomain.id == data.certification_domain_id)
        .first()
    )
    if cd is None:
        raise HTTPException(status_code=404, detail="Certification domain not found")

    cert = Certificate(
        name=data.name,
        description=data.description,
        certification_domain_id=data.certification_domain_id,
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)
    return cert


@router.put("/api/certificates/{cert_id}", response_model=CertificateResponse)
def update_certificate(
    cert_id: int,
    data: CertificateUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    cert = db.query(Certificate).filter(Certificate.id == cert_id).first()
    if cert is None:
        raise HTTPException(status_code=404, detail="Certificate not found")

    if data.name is not None:
        cert.name = data.name
    if data.description is not None:
        cert.description = data.description
    if data.certification_domain_id is not None:
        cd = (
            db.query(CertificationDomain)
            .filter(CertificationDomain.id == data.certification_domain_id)
            .first()
        )
        if cd is None:
            raise HTTPException(
                status_code=404, detail="Certification domain not found"
            )
        cert.certification_domain_id = data.certification_domain_id

    db.commit()
    db.refresh(cert)
    return cert


@router.delete("/api/certificates/{cert_id}")
def delete_certificate(
    cert_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    cert = db.query(Certificate).filter(Certificate.id == cert_id).first()
    if cert is None:
        raise HTTPException(status_code=404, detail="Certificate not found")

    skill_count = (
        db.query(SkillCertificate)
        .filter(SkillCertificate.certificate_id == cert_id)
        .count()
    )
    if skill_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete certificate with {skill_count} assigned skill(s)",
        )

    db.delete(cert)
    db.commit()
    return {"detail": "Certificate deleted"}
