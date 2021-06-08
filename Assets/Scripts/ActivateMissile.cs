using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class ActivateMissile : MonoBehaviour
{
    public HomingMissile missileMvt;
    public StayBoundedMissile boundMissile;

    public void ActivateMissileMvt()
    {
        missileMvt.enabled = true;
    }

    public void ActivateMissileBounds()
    {
        boundMissile.enabled = true;
    }

    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
